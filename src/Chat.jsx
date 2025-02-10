// src/Chat.js
import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Form, Button, ListGroup, Badge } from 'react-bootstrap';
import './Chat.css';
import { Utils, Conversation } from '@xmtp/browser-sdk'; // <-- Import Conversation here
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  const [myInboxId, setMyInboxId] = useState("");

  // --------------------------------------------------------------------------
  // Helper: Get a conversation’s inbox ID
  // --------------------------------------------------------------------------
  const getInboxId = useCallback(async (conv) => {
    try {
      if (conv && typeof conv.dmPeerInboxId === 'function') {
        return await conv.dmPeerInboxId();
      } else if (conv && conv.inboxId) {
        return conv.inboxId;
      } else {
        throw new Error("dmPeerInboxId not available on conversation");
      }
    } catch (err) {
      console.error("Error fetching inboxId for conversation:", err);
      throw new Error("Failed to fetch inboxId.");
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
        .catch((err) => console.error("Error computing myInboxId:", err));
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

      // Compute the key used for this conversation.
      let convInboxId;
      try {
        convInboxId = await getInboxId(conv);
      } catch (e) {
        // Fallback to conv.id if available.
        convInboxId = conv.id || 'unknown';
      }

      setMessagesByConversation((prev) => {
        const existing = prev[convInboxId] || [];
        const existingIds = new Set(existing.map((m) => m.id));
        const newUnique = fetchedMessages.filter((m) => !existingIds.has(m.id));
        return { ...prev, [convInboxId]: [...existing, ...newUnique] };
      });

      return fetchedMessages;
    } catch (err) {
      console.error(`Error fetching messages for conversation:`, err);
      setError('Failed to fetch messages.');
      return [];
    }
  }, [getInboxId]);

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

      // Deduplicate by inboxId
      const deduplicated = [];
      const seenIds = new Set();
      for (const c of validConversations) {
        if (!seenIds.has(c.inboxId)) {
          deduplicated.push(c);
          seenIds.add(c.inboxId);
        } else {
          // If needed, do special merging here
        }
      }

      // Now we only keep unique inbox IDs
      setConversations(deduplicated);

      // Initialize unread counts for unique list
      const initialUnread = {};
      deduplicated.forEach(({ inboxId }) => {
        initialUnread[inboxId] = 0;
      });
      setUnreadCounts(initialUnread);

      if (!selectedConversationId && deduplicated.length > 0) {
        const firstInboxId = deduplicated[0].inboxId;
        setSelectedConversationId(firstInboxId);
        await fetchMessagesForConversation(deduplicated[0].conv);
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
        if (isMounted) setError('Failed to initialize conversations.');
      }
    };
    init();
    return () => { isMounted = false; };
  }, [xmtpClient, fetchAllConversations]);

  // --------------------------------------------------------------------------
  // Streaming for New Messages
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!xmtpClient || !xmtpClient.conversations || typeof xmtpClient.conversations.streamAllMessages !== 'function')
      return;

    console.log("Starting stream for all messages via browser-sdk...");
    let streamCloser;

    const startStream = async () => {
      try {
        streamCloser = await xmtpClient.conversations.streamAllMessages((err, message) => {
          if (err) {
            console.error("Stream error:", err);
            return;
          }
          if (!message) return;

          // Use the conversation’s inbox id from its stored property or from the message.
          const inboxId = (message.conversation && message.conversation.inboxId) || message.senderInboxId;
          if (!inboxId) {
            console.warn("Streamed message missing conversation inbox id", message);
            return;
          }

          setMessagesByConversation((prev) => {
            const existing = prev[inboxId] || [];
            if (existing.find((m) => m.id === message.id)) return prev;
            return { ...prev, [inboxId]: [...existing, message] };
          });

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
    };

    startStream();
    return () => {
      if (streamCloser && streamCloser.end) streamCloser.end();
    };
  }, [xmtpClient, selectedConversationId]);

  // Creating or Selecting a DM Conversation Based on targetAddress
  useEffect(() => {
    if (!targetAddress || !xmtpClient) return;

    const initiateChat = async () => {
      try {
        const utils = new Utils(true);
        // Compute the DM peer’s inbox id from the target address.
        const derivedInboxId = await utils.getInboxIdForAddress(
          targetAddress,
          xmtpClient.options.XmtpEnv
        );
        if (!derivedInboxId) {
          console.warn("No valid inboxId for target address:", targetAddress);
          return;
        }
        console.log("Derived inboxId =", derivedInboxId, "for targetAddress =", targetAddress);

        // Try to get an existing DM from persistent storage.
        let convToUse = await xmtpClient.conversations.getDmByInboxId(derivedInboxId);
        if (convToUse) {
          console.log("Found existing DM conversation for inboxId:", derivedInboxId);
        } else {
          console.log("No existing DM found for", derivedInboxId, ", creating a new one...");
          convToUse = await xmtpClient.conversations.newDm(targetAddress);
        }

        // If the conversation does not have a messages() method,
        // re-instantiate it as a proper Conversation instance.
        if (convToUse && typeof convToUse.messages !== 'function') {
          console.log("Conversation instance missing messages method. Re-instantiating conversation.");
          convToUse = new Conversation(xmtpClient, convToUse.id, convToUse);
        }

        // Try to get the final inbox id.
        let finalInboxId;
        try {
          finalInboxId = await getInboxId(convToUse);
        } catch (error) {
          console.warn("Using derived inboxId as fallback", derivedInboxId);
          finalInboxId = derivedInboxId;
        }

        setConversations((prev) =>
          prev.some(({ inboxId }) => inboxId === finalInboxId)
            ? prev
            : [...prev, { inboxId: finalInboxId, conv: convToUse }]
        );
        setSelectedConversationId(finalInboxId);
        await fetchMessagesForConversation(convToUse);
      } catch (err) {
        console.error("Error initiating chat:", err);
        setError("Failed to initiate chat.");
      }
    };

    initiateChat();
  }, [targetAddress, xmtpClient, getInboxId, fetchMessagesForConversation]);

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
  const selectConversation = useCallback(async (inboxId) => {
    const conversation = conversations.find(({ inboxId: id }) => id === inboxId);
    if (!conversation) {
      setError('Conversation not found.');
      return;
    }
    setSelectedConversationId(inboxId);
    setUnreadCounts((prev) => ({ ...prev, [inboxId]: 0 }));
    await fetchMessagesForConversation(conversation.conv);
  }, [conversations, fetchMessagesForConversation]);

  // --------------------------------------------------------------------------
  // Helpers for Rendering Messages
  // --------------------------------------------------------------------------
  const getDisplayContent = (msg) => {
    const codec = xmtpClient?.codecFor?.(msg.contentType);
    return codec ? msg.content : (msg.fallback ?? '');
  };

  const convertSentAtNsToDate = (sentAtNs) => {
    const asNumber = typeof sentAtNs === 'bigint' ? Number(sentAtNs) : sentAtNs;
    return (!asNumber || Number.isNaN(asNumber)) ? undefined : new Date(asNumber / 1e6);
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
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar />
      {loadingConversations && <div className="loading-indicator">Loading conversations...</div>}
      <div className="conversations-list">
        <ListGroup>
          {conversations.map(({ inboxId }) => {
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
                {unread > 0 && <Badge bg="primary" pill>{unread}</Badge>}
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      </div>
      <div className="chat-window">
        {selectedConversation ? (
          <>
            <div className="chat-body">
              {error && (
                <Alert variant="danger" onClose={() => setError(null)} dismissible className="mb-2">
                  {error}
                </Alert>
              )}
              {messagesForSelected.length === 0 ? (
                <p className="text-muted">No messages yet.</p>
              ) : (
                messagesForSelected.map((msg) => {
                  if (!msg.id || !msg.senderInboxId || typeof msg.content === "undefined" || !msg.sentAtNs) {
                    console.warn("Encountered a message with missing properties:", msg);
                    return null;
                  }
                  // Instead of comparing senderInboxId with our DM inbox id (which is the peer’s),
                  // compare senderAddress (if available) with our account address.
                  const myAddress = xmtpClient.accountAddress?.toLowerCase() || "";
                  const isMe = msg.senderAddress
                    ? msg.senderAddress.toLowerCase() === myAddress
                    : (msg.senderInboxId.toLowerCase() === myInboxId);
                  const content = getDisplayContent(msg);
                  if (!content) return null;
                  const sentDate = convertSentAtNsToDate(msg.sentAtNs);
                  return (
                    <div
                      className="message-row"
                      key={msg.id}
                      style={{ justifyContent: isMe ? "flex-end" : "flex-start" }}
                    >
                      <div className={`message-bubble ${isMe ? "bubble-me" : "bubble-them"}`}>
                        {content}
                        <div className="message-meta">
                          {sentDate ? sentDate.toLocaleString() : "Unknown time"}
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
            <p>Select a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
