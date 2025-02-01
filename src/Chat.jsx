// src/Chat.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Form, Button, ListGroup, Badge } from 'react-bootstrap';
import './Chat.css';
import { Utils } from '@xmtp/browser-sdk';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const POLLING_INTERVAL_MS = 50000; // Poll every 50 seconds

const Chat = ({ xmtpClient, targetAddress }) => {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const [conversations, setConversations] = useState([]); // Array of { inboxId, conv }
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
  const getInboxId = useCallback(async (conv) => {
    try {
      const inboxId = await conv.dmPeerInboxId();
      return inboxId; // Assuming dmPeerInboxId now reliably returns a string
    } catch (err) {
      console.error('Error fetching inboxId for conversation:', err);
      throw new Error('Failed to fetch inboxId.');
    }
  }, []);

  // --------------------------------------------------------------------------
  // Fetch messages for a single conversation
  // --------------------------------------------------------------------------
  const fetchMessagesForConversation = useCallback(
    async (conv) => {
      if (!conv) return [];
      try {
        const fetchedMessages = await conv.messages();
        // Sort by timestamp ascending
        fetchedMessages.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));

        // Deduplicate and merge new messages into state
        setMessagesByConversation((prev) => {
          const inboxId = conv.dmPeerInboxId ? conv.dmPeerInboxId() : 'unknown';
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
        console.error(`Error fetching messages for conversation:`, err);
        setError('Failed to fetch messages.');
        return [];
      }
    },
    []
  );

  // --------------------------------------------------------------------------
  // Fetch All Conversations
  // --------------------------------------------------------------------------
  const fetchAllConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      await xmtpClient.conversations.syncAll();
      const allConversations = await xmtpClient.conversations.list();

      const conversationsWithInboxId = await Promise.all(
        allConversations.map(async (conv) => {
          try {
            const inboxId = await getInboxId(conv);
            return { inboxId, conv };
          } catch (err) {
            console.warn('Skipping conversation during fetchAll:', err);
            return null;
          }
        })
      );

      const validConversations = conversationsWithInboxId.filter(Boolean);
      setConversations(validConversations);

      // Initialize unread counts
      const initialUnread = {};
      validConversations.forEach(({ inboxId }) => {
        initialUnread[inboxId] = 0;
      });
      setUnreadCounts(initialUnread);

      // Select the first conversation if none is selected
      if (!selectedConversationId && validConversations.length > 0) {
        const firstInboxId = validConversations[0].inboxId;
        setSelectedConversationId(firstInboxId);
        await fetchMessagesForConversation(validConversations[0].conv);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to fetch conversations.');
    } finally {
      setLoadingConversations(false);
    }
  }, [xmtpClient, getInboxId, fetchMessagesForConversation, selectedConversationId]);

  // --------------------------------------------------------------------------
  // Initialization Effect
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
  // Polling for New Messages (only used if streaming is not available)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!xmtpClient) return;

    // If the browser SDK supports streaming, skip polling
    if (
      xmtpClient.conversations &&
      typeof xmtpClient.conversations.streamAllMessages === 'function'
    ) {
      console.log("Browser SDK supports streaming; skipping polling for new messages.");
      return;
    }

    let isMounted = true;

    const pollNewMessages = async () => {
      if (!isMounted) return;
      try {
        await xmtpClient.conversations.syncAll();
        const allConversations = await xmtpClient.conversations.list();

        const conversationsWithInboxId = await Promise.all(
          allConversations.map(async (conv) => {
            try {
              const inboxId = await getInboxId(conv);
              return { inboxId, conv };
            } catch (err) {
              console.warn('Skipping conversation in poll:', err);
              return null;
            }
          })
        );

        const validConversations = conversationsWithInboxId.filter(Boolean);
        setConversations(validConversations);

        // Fetch messages for the selected conversation
        if (selectedConversationId) {
          const selectedConv = validConversations.find(
            ({ inboxId }) => inboxId === selectedConversationId
          )?.conv;

          if (selectedConv) {
            const newMsgs = await selectedConv.messages();
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
  // Streaming for New Messages (only if supported by browser-sdk)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (
      !xmtpClient ||
      !xmtpClient.conversations ||
      typeof xmtpClient.conversations.streamAllMessages !== 'function'
    )
      return;

    console.log("Starting stream for all messages via browser-sdk...");

    let streamCloser;
    try {
      streamCloser = xmtpClient.conversations.streamAllMessages((err, message) => {
        if (err) {
          console.error("Stream error:", err);
          return;
        }
        if (!message) return;

        // Determine the inbox id for this message.
        // Here we assume that if the streamed message includes a nested conversation object,
        // it provides an 'inboxId' property. Otherwise, fall back to senderInboxId.
        const inboxId = (message.conversation && message.conversation.inboxId) || message.senderInboxId;
        if (!inboxId) {
          console.warn("Streamed message missing conversation inbox id", message);
          return;
        }

        // Merge the new message into the proper conversation’s messages (deduplicating by message id)
        setMessagesByConversation((prev) => {
          const existing = prev[inboxId] || [];
          if (existing.find((m) => m.id === message.id)) {
            return prev; // message already present
          }
          return {
            ...prev,
            [inboxId]: [...existing, message],
          };
        });

        // If the message is for a conversation that is not currently selected,
        // increase its unread count.
        if (inboxId !== selectedConversationId) {
          setUnreadCounts((prev) => ({
            ...prev,
            [inboxId]: (prev[inboxId] || 0) + 1,
          }));
        }
      });
    } catch (error) {
      console.error("Failed to start streamAllMessages:", error);
    }

    return () => {
      if (streamCloser && streamCloser.end) {
        streamCloser.end();
      }
    };
  }, [xmtpClient, selectedConversationId]);

  // --------------------------------------------------------------------------
  // Creating or Selecting a DM Conversation Based on targetAddress
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
        let convToUse = conversations.find(({ inboxId: id }) => id === inboxId)?.conv;
        if (!convToUse) {
          console.log('No existing DM found for', inboxId, ', creating a new one...');
          convToUse = await xmtpClient.conversations.newDm(targetAddress);
          // No need to cache inboxId
          const newInboxId = await getInboxId(convToUse);
          setConversations((prev) => [...prev, { inboxId: newInboxId, conv: convToUse }]);
        } else {
          console.log('Found existing DM conversation for inboxId:', inboxId);
        }

        const finalInboxId = await getInboxId(convToUse);

        // Initialize unread count if not present
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
  }, [targetAddress, xmtpClient, conversations, getInboxId, fetchMessagesForConversation]);

  // --------------------------------------------------------------------------
  // Send a Message to the Selected Conversation
  // --------------------------------------------------------------------------
  const sendMessage = useCallback(async () => {
    if (!selectedConversationId || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      const conversation = conversations.find(({ inboxId }) => inboxId === selectedConversationId);
      if (!conversation) {
        setError('Selected conversation not found.');
        return;
      }
      await conversation.conv.send(messageText.trim());
      setMessageText('');

      // Fetch messages for the current conversation
      await fetchMessagesForConversation(conversation.conv);
      toast.success('Message sent successfully!');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedConversationId, messageText, conversations, fetchMessagesForConversation]);

  // --------------------------------------------------------------------------
  // Manually Select a Conversation from the Side List
  // --------------------------------------------------------------------------
  const selectConversation = useCallback(
    async (inboxId) => {
      const conversation = conversations.find(({ inboxId: id }) => id === inboxId);
      if (!conversation) {
        setError('Conversation not found.');
        return;
      }
      setSelectedConversationId(inboxId);
      // Reset unread count
      setUnreadCounts((prev) => ({
        ...prev,
        [inboxId]: 0,
      }));

      // Load its messages
      await fetchMessagesForConversation(conversation.conv);
    },
    [conversations, fetchMessagesForConversation]
  );

  // --------------------------------------------------------------------------
  // Helpers for Rendering Messages
  // --------------------------------------------------------------------------
  const getDisplayContent = (msg) => {
    if (!msg) return '';
    const codec = xmtpClient?.codecFor?.(msg.contentType);
    if (!codec) {
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
  // Derived: The Selected Conversation and Its Messages
  // --------------------------------------------------------------------------
  const selectedConversation = selectedConversationId
    ? conversations.find(({ inboxId }) => inboxId === selectedConversationId)?.conv
    : null;

  const messagesForSelected = messagesByConversation[selectedConversationId] || [];

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="chat-container">
      {/* Toast Notifications */}
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar />

      {/* Side Panel: List only the last conversation per inbox ID */}
      {loadingConversations && (
        <div className="loading-indicator">Loading conversations...</div>
      )}
      <div className="conversations-list">
        <ListGroup>
          {conversations.map(({ inboxId, conv }) => {
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
                  if (!content) return null; // e.g., read receipts/unsupported

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
              <Button variant="primary" onClick={sendMessage} disabled={isSendingMessage}>
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
