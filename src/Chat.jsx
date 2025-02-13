// src/Chat.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Form,
  Button,
  ListGroup,
  Badge,
  Spinner,
} from 'react-bootstrap';
import './Chat.css';
import {
  Utils,
  Conversation,
  ConsentState,
  // If you need advanced usage, also import: ConsentEntityType, PermissionPolicy, ...
} from '@xmtp/browser-sdk';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Chat = ({ xmtpClient, targetAddress }) => {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const [conversations, setConversations] = useState([]); // Allowed convs
  const [conversationRequests, setConversationRequests] = useState([]); // Unknown/Denied
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [myInboxId, setMyInboxId] = useState('');

  // --------------------------------------------------------------------------
  // Helper: Return a unique “merge key” for each conversation
  // --------------------------------------------------------------------------
  const getConversationKey = useCallback(async (conv) => {
    try {
      const peerInboxId = await conv.dmPeerInboxId();
      if (peerInboxId) {
        // Include the conversation ID to differentiate between different conversation objects.
        return `dm:${conv.id}:${peerInboxId}`;
      } else {
        return `grp:${conv.id}`;
      }
    } catch (err) {
      console.warn('Could not get dmPeerInboxId, using conv.id:', err);
      return `grp:${conv.id}`;
    }
  }, []);
  

  // --------------------------------------------------------------------------
  // Compute my own inbox ID (for our account)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (xmtpClient && xmtpClient.accountAddress) {
      const utils = new Utils(true);
      utils
        .getInboxIdForAddress(xmtpClient.accountAddress, xmtpClient.options.XmtpEnv)
        .then((id) => setMyInboxId(id.toLowerCase()))
        .catch((err) => console.error('Error computing myInboxId:', err));
    }
  }, [xmtpClient]);

  // --------------------------------------------------------------------------
  // Fetch messages for a single conversation
  // --------------------------------------------------------------------------
  const fetchMessagesForConversation = useCallback(async (conv) => {
    if (!conv) return [];
    try {
      const fetchedMessages = await conv.messages();
      fetchedMessages.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));

      // Use our “merge key” for storing messages
      const key = await getConversationKey(conv);

      setMessagesByConversation((prev) => {
        const existing = prev[key] || [];
        const existingIds = new Set(existing.map((m) => m.id));
        const newUnique = fetchedMessages.filter((m) => !existingIds.has(m.id));
        return { ...prev, [key]: [...existing, ...newUnique] };
      });

      return fetchedMessages;
    } catch (err) {
      console.error('Error fetching messages for conversation:', err);
      setError('Failed to fetch messages.');
      return [];
    }
  }, [getConversationKey]);

  // --------------------------------------------------------------------------
  // Helper to fetch the "display name" for a given "dm:..." key
  // by calling client.getLatestInboxState(inboxId)
  // --------------------------------------------------------------------------
  const getDisplayNameForKey = useCallback(
    async (key, conv) => {
      if (key.startsWith('grp:')) {
        return `Group: ${conv.id}`;
      }
      // DM conversation: key format is "dm:<conv.id>:<peerInboxId>"
      const parts = key.split(':');
      const peerInboxId = parts[2]; // index 2 holds the peer inbox id
      try {
        const inboxState = await xmtpClient.getLatestInboxState(peerInboxId);
        if (inboxState?.accountAddresses?.length) {
          return inboxState.accountAddresses[0];
        }
        return `DM: ${peerInboxId}`;
      } catch (err) {
        console.error('Error getting inbox state:', err);
        return `DM: ${peerInboxId}`;
      }
    },
    [xmtpClient]
  );
  

  // --------------------------------------------------------------------------
  // Gather all conversations, grouping by unique “merge key”
  // Then divide them by consentState: Allowed vs Unknown/Denied
  // --------------------------------------------------------------------------
  const fetchAllConversations = useCallback(async () => {
    if (!xmtpClient) return;
    setLoadingConversations(true);

    try {
      await xmtpClient.conversations.syncAll();
      await xmtpClient.conversations.sync();
      const all = await xmtpClient.conversations.list();

      // For each conversation, get “merge key” and consentState
      const convData = await Promise.all(
        all.map(async (conv) => {
          try {
            const key = await getConversationKey(conv);
            const state = await conv.consentState(); // e.g. Allowed/Unknown/Denied
            // NEW: Get a displayName from the inbox state
            const displayName = await getDisplayNameForKey(key, conv);

            return { key, conv, consentState: state, displayName };
          } catch (err) {
            console.warn('Skipping conv due to error:', err);
            return null;
          }
        })
      );

      const valid = convData.filter(Boolean);

      // Build a map: key -> array of (conv objects)
      const convoMap = {};
      for (const item of valid) {
        if (!convoMap[item.key]) {
          convoMap[item.key] = [];
        }
        convoMap[item.key].push(item);
      }

      // Now produce final arrays for Allowed and Requests
      const allowedList = [];
      const requestList = [];

      // For each key, we might have multiple conv objects with different states
      Object.keys(convoMap).forEach((key) => {
        const variants = convoMap[key];
        // Separate by state
        const allowed = variants.filter((v) => v.consentState === ConsentState.Allowed);
        const unknownOrDenied = variants.filter(
          (v) => v.consentState === ConsentState.Unknown || v.consentState === ConsentState.Denied
        );

        // If there's at least one Allowed, pick the first one as the "main"
        if (allowed.length > 0) {
          allowedList.push({
            inboxId: key,
            conv: allowed[0].conv,
            consentState: ConsentState.Allowed,
            displayName: allowed[0].displayName, // NEW
          });
        }

        // Keep the unknown/denied ones as requests
        unknownOrDenied.forEach((r) => {
          requestList.push({
            inboxId: r.key,
            conv: r.conv,
            consentState: r.consentState,
            displayName: r.displayName, // NEW
          });
        });
      });

      setConversations(allowedList);
      setConversationRequests(requestList);

      // Initialize unread counts
      const allKeys = [
        ...allowedList.map((c) => c.inboxId),
        ...requestList.map((r) => r.inboxId),
      ];
      const initialUnread = {};
      for (const k of allKeys) {
        if (typeof initialUnread[k] === 'undefined') {
          initialUnread[k] = 0;
        }
      }
      setUnreadCounts(initialUnread);

      // Auto-select the first Allowed conversation if none is selected
      if (!selectedConversationId && allowedList.length > 0) {
        setSelectedConversationId(allowedList[0].inboxId);
        await fetchMessagesForConversation(allowedList[0].conv);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to fetch conversations.');
    } finally {
      setLoadingConversations(false);
    }
  }, [
    xmtpClient,
    getConversationKey,
    getDisplayNameForKey, // NEW
    selectedConversationId,
    fetchMessagesForConversation,
  ]);

  // --------------------------------------------------------------------------
  // Initialization Effect
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!xmtpClient) return;

      try {
        const myAddress = xmtpClient.accountAddress;
        if (!myAddress) {
          if (isMounted) setError('User address not found.');
          return;
        }
        await fetchAllConversations();
      } catch (err) {
        console.error('Error initializing:', err);
        if (isMounted) setError('Failed to initialize conversations.');
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [xmtpClient, fetchAllConversations]);

  // --------------------------------------------------------------------------
  // Streaming new messages
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (
      !xmtpClient ||
      !xmtpClient.conversations ||
      typeof xmtpClient.conversations.streamAllMessages !== 'function'
    )
      return;

    console.log('Starting streamAllMessages...');
    let streamCloser;

    const startStream = async () => {
      try {
        streamCloser = await xmtpClient.conversations.streamAllMessages(
          async (err, message) => {
            if (err) {
              console.error('streamAllMessages error:', err);
              return;
            }
            if (!message) return;

            // Derive the key from the conversation in the message
            let key;
            if (message.conversation && typeof message.conversation.dmPeerInboxId === 'function') {
              // We can compute the key from the conversation instance
              key = await getConversationKey(message.conversation);
            } else if (message.senderInboxId) {
              // fallback if we can't get the conversation instance
              key = `dm:${message.senderInboxId}`;
            } else {
              console.warn('Cannot determine conversation key from streamed message', message);
              return;
            }

            // Insert the new message
            setMessagesByConversation((prev) => {
              const existing = prev[key] || [];
              if (existing.some((m) => m.id === message.id)) {
                return prev; // already have it
              }
              return { ...prev, [key]: [...existing, message] };
            });

            // Bump unread if it's not the currently selected conversation
            if (key !== selectedConversationId) {
              setUnreadCounts((prev) => ({
                ...prev,
                [key]: (prev[key] || 0) + 1,
              }));
            }
          }
        );
      } catch (e) {
        console.error('Failed to start streamAllMessages:', e);
      }
    };

    startStream();
    return () => {
      if (streamCloser && streamCloser.end) streamCloser.end();
    };
  }, [xmtpClient, getConversationKey, selectedConversationId]);

  // --------------------------------------------------------------------------
  // Creating or Selecting a DM Conversation Based on targetAddress
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!targetAddress || !xmtpClient) return;

    const initiateChat = async () => {
      try {
        const utils = new Utils(true);
        // For a DM, get the peer’s inbox id from the target address
        const derivedInboxId = await utils.getInboxIdForAddress(
          targetAddress,
          xmtpClient.options.XmtpEnv
        );
        if (!derivedInboxId) {
          console.warn('No valid inboxId for target:', targetAddress);
          return;
        }

        // Try to fetch an existing DM, or create a new one
        let convToUse = await xmtpClient.conversations.getDmByInboxId(derivedInboxId);
        if (!convToUse) {
          convToUse = await xmtpClient.conversations.newDm(targetAddress);
        }

        // Make sure conv is a fully functional instance
        if (convToUse && typeof convToUse.messages !== 'function') {
          convToUse = new Conversation(xmtpClient, convToUse.id, convToUse);
        }

        // Compute our “merge key”
        const key = await getConversationKey(convToUse);
        const state = await convToUse.consentState();

        // NEW: Also compute the displayName
        const displayName = await getDisplayNameForKey(key, convToUse);

        // If it’s Allowed, put it in the main “conversations” array,
        // otherwise it goes into “conversationRequests”
        if (state === ConsentState.Allowed) {
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.inboxId === key);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { inboxId: key, conv: convToUse, consentState: state, displayName };
              return copy;
            }
            return [...prev, { inboxId: key, conv: convToUse, consentState: state, displayName }];
          });
        } else {
          setConversationRequests((prev) => {
            const idx = prev.findIndex((r) => r.inboxId === key);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { inboxId: key, conv: convToUse, consentState: state, displayName };
              return copy;
            }
            return [...prev, { inboxId: key, conv: convToUse, consentState: state, displayName }];
          });
        }

        // Select the conversation
        setSelectedConversationId(key);

        // Fetch messages
        await fetchMessagesForConversation(convToUse);
      } catch (err) {
        console.error('Error initiating chat:', err);
        setError('Failed to initiate chat.');
      }
    };

    initiateChat();
  }, [targetAddress, xmtpClient, getConversationKey, getDisplayNameForKey, fetchMessagesForConversation]);

  // --------------------------------------------------------------------------
  // Accept a conversation request: update to Allowed
  // --------------------------------------------------------------------------
  const acceptConversationRequest = useCallback(async (reqKey) => {
    try {
      const requestObj = conversationRequests.find((r) => r.inboxId === reqKey);
      if (!requestObj) return;
      await requestObj.conv.updateConsentState(ConsentState.Allowed);

      // Move it to the main conversations array
      setConversationRequests((prev) => prev.filter((r) => r.inboxId !== reqKey));
      setConversations((prev) => [
        ...prev,
        { ...requestObj, consentState: ConsentState.Allowed },
      ]);

      // Select it
      setSelectedConversationId(reqKey);

      // Optionally fetch messages again
      await fetchMessagesForConversation(requestObj.conv);
    } catch (error) {
      console.error('Error accepting conversation request:', error);
      setError('Failed to accept request. Please try again.');
    }
  }, [conversationRequests, fetchMessagesForConversation]);

  // --------------------------------------------------------------------------
  // Send a Message to the Selected Conversation
  // --------------------------------------------------------------------------
  const sendMessage = useCallback(async () => {
    if (!selectedConversationId || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      // Could be in main or requests
      const convObj =
        conversations.find((c) => c.inboxId === selectedConversationId) ||
        conversationRequests.find((c) => c.inboxId === selectedConversationId);

      if (!convObj) {
        setError('Selected conversation not found.');
        return;
      }

      await convObj.conv.send(messageText.trim());
      setMessageText('');
      await fetchMessagesForConversation(convObj.conv);
      toast.success('Message sent successfully!');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    selectedConversationId,
    messageText,
    conversations,
    conversationRequests,
    fetchMessagesForConversation,
  ]);

  // --------------------------------------------------------------------------
  // Manually Select a Conversation (Allowed or Request)
  // --------------------------------------------------------------------------
  const selectConversation = useCallback(async (inboxId) => {
    const convObj =
      conversations.find((c) => c.inboxId === inboxId) ||
      conversationRequests.find((c) => c.inboxId === inboxId);
    if (!convObj) {
      setError('Conversation not found.');
      return;
    }

    setSelectedConversationId(inboxId);
    setUnreadCounts((prev) => ({ ...prev, [inboxId]: 0 }));
    await fetchMessagesForConversation(convObj.conv);
  }, [conversations, conversationRequests, fetchMessagesForConversation]);

  // --------------------------------------------------------------------------
  // Helpers for Rendering
  // --------------------------------------------------------------------------
  const getDisplayContent = (msg) => {
    const codec = xmtpClient?.codecFor?.(msg.contentType);
    return codec ? msg.content : msg.fallback ?? '';
  };

  const convertSentAtNsToDate = (sentAtNs) => {
    const asNumber = typeof sentAtNs === 'bigint' ? Number(sentAtNs) : sentAtNs;
    return !asNumber || Number.isNaN(asNumber) ? undefined : new Date(asNumber / 1e6);
  };

  // The selected conversation might be in either the main array or the requests array
  const selectedObj =
    conversations.find((c) => c.inboxId === selectedConversationId) ||
    conversationRequests.find((c) => c.inboxId === selectedConversationId);
  const selectedConversation = selectedObj?.conv || null;
  const messagesForSelected = messagesByConversation[selectedConversationId] || [];

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="chat-container">
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar />
      <div className="conversations-list">
        {loadingConversations && (
          <div className="loading-indicator">
            <Spinner animation="border" size="sm" /> 
          </div>
        )}
        <h5>Conversations</h5>
        <ListGroup>
          {conversations.map(({ inboxId, displayName }) => {
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
                {/* Instead of showing `inboxId`, we show `displayName` */}
                {displayName}
                {unread > 0 && <Badge bg="primary">{unread}</Badge>}
              </ListGroup.Item>
            );
          })}
        </ListGroup>

        {conversationRequests.length > 0 && (
          <>
            <h5 className="mt-4">Requests</h5>
            <ListGroup>
              {conversationRequests.map(({ inboxId, consentState, displayName }) => {
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
                    <div>
                      {displayName}
                      {consentState === ConsentState.Denied && (
                        <Badge bg="danger" className="ms-2">
                          Denied
                        </Badge>
                      )}
                    </div>
                    <div>
                      {unread > 0 && <Badge bg="primary">{unread}</Badge>}
                      {consentState !== ConsentState.Denied && (
                        <Button
                          variant="success"
                          size="sm"
                          className="ms-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptConversationRequest(inboxId);
                          }}
                        >
                          Accept
                        </Button>
                      )}
                    </div>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          </>
        )}
      </div>

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
                  const myAddress = xmtpClient.accountAddress?.toLowerCase() || '';
                  const isMe = msg.senderAddress
                    ? msg.senderAddress.toLowerCase() === myAddress
                    : msg.senderInboxId.toLowerCase() === myInboxId;
                  const content = getDisplayContent(msg);
                  if (!content) return null;
                  const sentDate = convertSentAtNsToDate(msg.sentAtNs);

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

            <div className="chat-footer">
              {isSendingMessage && <div className="sending-indicator">Sending...</div>}
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
            <p>Select or accept a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
