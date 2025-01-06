// src/Chat.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Form, Button, ListGroup, Badge } from 'react-bootstrap';
import './Chat.css';
import { Utils } from '@xmtp/browser-sdk';

const POLLING_INTERVAL_MS = 50000; // Poll every 50 seconds

const Chat = ({ xmtpClient, targetAddress }) => {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const [conversationsMap, setConversationsMap] = useState(new Map());
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const pollingIntervalRef = useRef(null);
  const prevTargetAddressRef = useRef(targetAddress);

  // --------------------------------------------------------------------------
  // Helper: Get DM conversation inbox ID (async)
  // --------------------------------------------------------------------------
  const getInboxId = async (conv) => {
    if (!conv.cachedInboxId) {
      try {
        // dmPeerInboxId() might return either a string or an object with { value: string }
        // Adjust based on your actual XMTP environment
        const inboxIdObj = await conv.dmPeerInboxId();
        // If it returns { value: '...' }, do: conv.cachedInboxId = inboxIdObj.value;
        conv.cachedInboxId = inboxIdObj.value || inboxIdObj;
      } catch (err) {
        console.error('Error fetching inboxId for conversation:', err);
        throw new Error('Failed to fetch inboxId.');
      }
    }
    return conv.cachedInboxId;
  };

  // --------------------------------------------------------------------------
  // Locally check for an existing DM by its cachedInboxId
  // --------------------------------------------------------------------------
  const getDmByInboxId = useCallback(
    (inboxId) => {
      for (let conv of conversationsMap.values()) {
        if (conv.cachedInboxId === inboxId) {
          return conv;
        }
      }
      return null;
    },
    [conversationsMap]
  );

  // --------------------------------------------------------------------------
  // Fetch messages for a single conversation
  // --------------------------------------------------------------------------
  const fetchMessagesForConversation = useCallback(
    async (conv) => {
      if (!conv) return [];
      const inboxId = await getInboxId(conv);
      try {
        const fetchedMessages = await conv.messages();
        // Sort by timestamp ascending
        fetchedMessages.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));

        // Deduplicate
        setMessagesByConversation((prev) => {
          const existing = prev[inboxId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const newUnique = fetchedMessages.filter((m) => !existingIds.has(m.id));
          return {
            ...prev,
            [inboxId]: [...existing, ...newUnique],
          };
        });

        return fetchedMessages;
      } catch (err) {
        console.error(`Error fetching messages for ${inboxId}:`, err);
        setError('Failed to fetch messages.');
        return [];
      }
    },
    [getInboxId]
  );

  // --------------------------------------------------------------------------
  // Instead of fetching messages for ALL conversations, we only fetch
  // them for the "latest" or for user-selected conversation.
  // This significantly reduces load time if a user has many test convs
  // with the same inbox ID.
  // --------------------------------------------------------------------------
  const fetchAllConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      await xmtpClient.conversations.syncAll();
      const allConversations = await xmtpClient.conversations.list();

      // We'll store ONLY the "latest" conversation per inboxId
      // If multiple convs have the same ID, we pick the last one in the array
      // (assuming the array is sorted by creation time or any other logic).
      const convsMap = new Map();
      for (let conv of allConversations) {
        try {
          const inboxId = await getInboxId(conv);

          // If there's already a conversation for that inboxId, we replace it
          // with the new one, effectively keeping the "last" one.
          // Or skip if you prefer the first one you encounter.
          convsMap.set(inboxId, conv);
        } catch (err) {
          console.warn('Skipping conversation during fetchAll:', err);
        }
      }

      // Now we store only the final conv for each inbox ID
      setConversationsMap(convsMap);

      // Initialize unread counts to 0 for these conversation IDs
      const initialUnread = {};
      convsMap.forEach((_, inboxId) => {
        initialUnread[inboxId] = 0;
      });
      setUnreadCounts(initialUnread);

      // We do NOT fetch messages for all convs upfront.
      // Instead, we only fetch messages for the user-selected one
      // or for new ones we create.
      // => This avoids big overhead if there's a ton of old convs.

      // If no conversation selected yet, pick the first
      if (!selectedConversationId && convsMap.size > 0) {
        const firstInboxId = convsMap.keys().next().value;
        setSelectedConversationId(firstInboxId);
        // Optionally fetch messages for that first conversation
        const firstConv = convsMap.get(firstInboxId);
        await fetchMessagesForConversation(firstConv);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to fetch conversations.');
    } finally {
      setLoadingConversations(false); // <-- End loading
    }
  }, [xmtpClient, getInboxId, fetchMessagesForConversation, selectedConversationId]);

  // --------------------------------------------------------------------------
  // Initialization effect
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!xmtpClient) return;
    let isMounted = true;

    const init = async () => {
      try {
        const myAddress = xmtpClient.accountAddress;
        if (!myAddress) {
          console.error("xmtpClient does not have an 'accountAddress' property.");
          if (isMounted) setError('User address not found.');
          return;
        }
        await fetchAllConversations();
      } catch (err) {
        console.error('Error initializing conversations:', err);
        if (isMounted) {
          setError('Failed to initialize conversations.');
        }
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [xmtpClient, fetchAllConversations]);

  // --------------------------------------------------------------------------
  // Polling for new messages
  // We skip fetching messages for every conversation; only for the selected one
  // to reduce load. If you want to track unread on all convs, you'd need to fetch
  // them, but that might be expensive.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!xmtpClient) return;
    let isMounted = true;

    const pollNewMessages = async () => {
      if (!isMounted) return;
      try {
        await xmtpClient.conversations.syncAll();
        const allConversations = await xmtpClient.conversations.list();

        // Build a new map that only keeps the last conversation per inboxId
        const newConvsMap = new Map();
        for (let conv of allConversations) {
          try {
            const inboxId = await getInboxId(conv);
            newConvsMap.set(inboxId, conv);
          } catch (err) {
            console.warn('Skipping group conversation in poll:', err);
          }
        }
        setConversationsMap(newConvsMap);

        // Minimally fetch messages for the currently selected conversation
        if (selectedConversationId && newConvsMap.has(selectedConversationId)) {
          const conv = newConvsMap.get(selectedConversationId);
          const newMsgs = await conv.messages();
          newMsgs.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));

          setMessagesByConversation((prev) => {
            const existing = prev[selectedConversationId] || [];
            const existingIds = new Set(existing.map((m) => m.id));
            const newUnique = newMsgs.filter((m) => !existingIds.has(m.id));
            return {
              ...prev,
              [selectedConversationId]: [...existing, ...newUnique],
            };
          });
        }
      } catch (err) {
        console.error('Error during polling:', err);
        if (isMounted) setError('Error fetching new messages.');
      }
    };

    // Immediate poll once
    pollNewMessages();
    pollingIntervalRef.current = setInterval(pollNewMessages, POLLING_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [xmtpClient, getInboxId, selectedConversationId]);

  // --------------------------------------------------------------------------
  // Creating or selecting a DM conversation based on targetAddress
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!targetAddress || !xmtpClient) return;
    console.log('Target address changed to:', targetAddress);

    if (
      prevTargetAddressRef.current &&
      targetAddress.toLowerCase() === prevTargetAddressRef.current.toLowerCase()
    ) {
      return; // No change
    }
    prevTargetAddressRef.current = targetAddress;

    const initiateChat = async () => {
      try {
        const utils = new Utils(true);
        // Derive an inboxId for the address
        const inboxId = await utils.getInboxIdForAddress(
          targetAddress,
          xmtpClient.options.XmtpEnv
        );
        if (!inboxId) {
          console.warn('No valid inboxId for target address:', targetAddress);
          return;
        }
        console.log('Derived inboxId =', inboxId, 'for targetAddress =', targetAddress);

        // Check if we have a conversation for this inboxId
        let convToUse = getDmByInboxId(inboxId);
        if (!convToUse) {
          console.log('No existing DM found for', inboxId, ', creating a new one...');
          convToUse = await xmtpClient.conversations.newDm(targetAddress);
          await getInboxId(convToUse); // set its cachedInboxId
        } else {
          console.log('Found existing DM conversation for inboxId:', inboxId);
        }

        const finalInboxId = convToUse.cachedInboxId;

        // Put it in conversation map, overwriting any older entry
        setConversationsMap((prev) => {
          const updated = new Map(prev);
          updated.set(finalInboxId, convToUse);
          return updated;
        });

        // If there's no unread count for this inboxId, initialize it
        setUnreadCounts((prev) => ({
          ...prev,
          [finalInboxId]: prev[finalInboxId] || 0,
        }));

        // Select this conversation & fetch its messages
        setSelectedConversationId(finalInboxId);
        await fetchMessagesForConversation(convToUse);
      } catch (err) {
        console.error('Error initiating chat:', err);
        setError('Failed to initiate chat.');
      }
    };

    initiateChat();
  }, [targetAddress, xmtpClient, getDmByInboxId, getInboxId, fetchMessagesForConversation]);

  // --------------------------------------------------------------------------
  // Send a message to the selected conversation
  // --------------------------------------------------------------------------
  const sendMessage = async () => {
    if (!selectedConversationId || !messageText.trim()) return;
    setIsSendingMessage(true);    // <-- Start sending
    try {
      const conv = conversationsMap.get(selectedConversationId);
      if (!conv) {
        setError('Selected conversation not found.');
        return;
      }
      await conv.send(messageText.trim());
      setMessageText('');

      // Fetch messages for the current conversation
      await fetchMessagesForConversation(conv);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false); // <-- Done sending
    }
  };

  // --------------------------------------------------------------------------
  // Manually select a conversation from the side list
  // --------------------------------------------------------------------------
  const selectConversation = async (inboxId) => {
    if (!inboxId || !conversationsMap.has(inboxId)) {
      setError('Conversation not found.');
      return;
    }
    setSelectedConversationId(inboxId);
    // Reset unread count
    setUnreadCounts((prev) => ({
      ...prev,
      [inboxId]: 0,
    }));

    // On selecting a new conversation, load its messages (on demand).
    const conv = conversationsMap.get(inboxId);
    await fetchMessagesForConversation(conv);
  };

  // --------------------------------------------------------------------------
  // Helpers for rendering messages
  // --------------------------------------------------------------------------
  const getDisplayContent = (msg) => {
    if (!msg) return '';
    const codec = xmtpClient?.codecFor?.(msg.contentType);
    if (!codec) {
      // If there's a fallback, show it. Otherwise, skip.
      return msg.fallback ?? '';
    }
    return msg.content;
  };

  const convertSentAtNsToDate = (sentAtNs) => {
    const asNumber = typeof sentAtNs === 'bigint' ? Number(sentAtNs) : sentAtNs;
    if (!asNumber || Number.isNaN(asNumber)) return undefined;
    return new Date(asNumber / 1e6); // ns -> ms
  };

  // --------------------------------------------------------------------------
  // Derived: The selected conversation and its messages
  // --------------------------------------------------------------------------
  const selectedConversation = selectedConversationId
    ? conversationsMap.get(selectedConversationId)
    : null;

  const messagesForSelected = messagesByConversation[selectedConversationId] || [];

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  const conversationArray = Array.from(conversationsMap.entries());
  console.log('Render: conversationArray length is', conversationArray.length);

  return (
    <div className="chat-container">
      {/* Side Panel: List only the last conversation per inbox ID */}
      {loadingConversations && (
        <div className="loading-indicator">Loading conversations...</div>
      )}
      <div className="conversations-list">
        <ListGroup>
          {conversationArray.map(([inboxId, conv]) => {
            const isActive = selectedConversationId === inboxId;
            const unread = unreadCounts[inboxId] || 0;

            return (
              <ListGroup.Item
                key={inboxId}
                action
                active={isActive}
                onClick={() => selectConversation(inboxId)}
                className="d-flex justify-content-between align-items-center"
              >
                {inboxId}
                {unread > 0 && (
                  <Badge bg="primary" pill>
                    {unread}
                  </Badge>
                )}
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        {selectedConversation ? (
          <>
            <div className="chat-body">
              {error && (
                <Alert
                  variant="danger"
                  onClose={() => setError(null)}
                  dismissible
                  className="mb-2"
                >
                  {error}
                </Alert>
              )}

              {messagesForSelected.length === 0 ? (
                <p className="text-muted">No messages yet.</p>
              ) : (
                messagesForSelected.map((msg) => {
                  if (
                    !msg.id ||
                    !msg.senderInboxId ||
                    typeof msg.content === 'undefined' ||
                    !msg.sentAtNs
                  ) {
                    console.warn('Encountered a message with missing properties:', msg);
                    return null;
                  }

                  const content = getDisplayContent(msg);
                  if (!content) return null; // e.g. read receipts/unsupported

                  const sentDate = convertSentAtNsToDate(msg.sentAtNs);
                  const myInboxId = xmtpClient.inboxId?.toLowerCase() || '';
                  const isMe = msg.senderInboxId.toLowerCase() === myInboxId;

                  return (
                    <div
                      className="message-row"
                      key={msg.id}
                      style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}
                    >
                      <div className={`message-bubble ${isMe ? 'bubble-me' : 'bubble-them'}`}>
                        {content}
                        <div className="message-meta">
                          {sentDate ? sentDate.toLocaleString() : 'Unknown time'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input / Send */}
            <div className="chat-footer">
              {isSendingMessage && (
                <div className="sending-indicator">Sending...</div>
              )}
              <Form.Group controlId="messageText" className="mb-2">
                <Form.Control
                  type="text"
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      await sendMessage();
                    }
                  }}
                />
              </Form.Group>
              <Button variant="primary" onClick={sendMessage}>
                Send
              </Button>
            </div>
          </>
        ) : (
          <div className="no-conversation-selected">
            <p>Select a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
