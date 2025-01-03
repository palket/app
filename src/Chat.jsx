// src/Chat.js
import React, { useState, useEffect, useRef } from 'react';
import { Alert, Form, Button, ListGroup, Badge } from 'react-bootstrap';
import './Chat.css';

const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds

const Chat = ({ xmtpClient, targetAddress }) => {
  const [conversations, setConversations] = useState([]); // List of all conversations
  const [conversationAddresses, setConversationAddresses] = useState({}); // Mapping of conversation.id to address
  const [selectedConversation, setSelectedConversation] = useState(null); // Currently selected conversation
  const [messages, setMessages] = useState([]); // Messages of the selected conversation
  const [messageText, setMessageText] = useState(''); // Text input
  const [error, setError] = useState(null); // Error state
  const [unreadCounts, setUnreadCounts] = useState({}); // Unread messages per conversation

  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (targetAddress) {
        const initiateChat = async () => {
            try {
            // Check if a conversation with targetAddress already exists
            const existingConv = conversations.find(
                (conv) => conversationAddresses[conv.id]?.toLowerCase() === targetAddress.toLowerCase()
            );
            if (existingConv) {
                setSelectedConversation(existingConv);
                await fetchMessages(existingConv);
            } else {
                // Create a new conversation
                const newConv = await xmtpClient.conversations.newDm(targetAddress);
                setConversations((prevConvs) => [...prevConvs, newConv]);
                setConversationAddresses((prev) => ({ ...prev, [newConv.id]: targetAddress }));
                setSelectedConversation(newConv);
                await fetchMessages(newConv);
            }
            } catch (error) {
            console.error('Error initiating chat:', error);
            setError('Failed to initiate chat.');
            }
        };
        initiateChat();
    }
  }, [targetAddress]);
    

  // Function to fetch and update messages for a specific conversation
  const fetchMessages = async (conv) => {
    try {
      const fetchedMessages = await conv.messages();
      // Sort messages by timestamp ascending
      fetchedMessages.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));

      // Deduplicate messages based on unique message IDs
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newUnique = fetchedMessages.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newUnique];
      });
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to fetch messages.');
    }
  };

  // Function to map conversation inbox IDs to addresses
  const mapConversationsToAddresses = async (convs) => {
    const addressMap = {};
    for (const conv of convs) {
      const otherMember = conv.members.find(
        (member) => member.toLowerCase() !== xmtpClient.inboxId.toLowerCase()
      );
      if (otherMember) {
        try {
          const address = await xmtpClient.findAddressByInboxId(otherMember);
          addressMap[conv.id] = address || 'Unknown';
        } catch (error) {
          console.error(`Error finding address for inbox ID ${otherMember}:`, error);
          addressMap[conv.id] = 'Unknown';
        }
      } else {
        addressMap[conv.id] = 'Unknown';
      }
    }
    setConversationAddresses(addressMap);
  };

  // Function to fetch all conversations and initialize states
  const fetchAllConversations = async () => {
    try {
      const allConversations = await xmtpClient.conversations.list();
      setConversations(allConversations);

      // Map conversations to addresses
      await mapConversationsToAddresses(allConversations);

      // Initialize unread counts
      const initialUnread = {};
      allConversations.forEach((conv) => {
        initialUnread[conv.id] = 0;
      });
      setUnreadCounts(initialUnread);

      // Optionally select the first conversation by default
      if (allConversations.length > 0) {
        setSelectedConversation(allConversations[0]);
        await fetchMessages(allConversations[0]);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to fetch conversations.');
    }
  };

  // Initialize by fetching all conversations
  useEffect(() => {
    if (!xmtpClient) return;

    let isMounted = true;

    const init = async () => {
      try {
        await xmtpClient.conversations.syncAll();
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
  }, [xmtpClient]);

  // Set up polling to fetch new messages periodically
  useEffect(() => {
    if (!xmtpClient) return;

    const pollNewMessages = async () => {
      try {
        await xmtpClient.conversations.syncAll();
        const allConversations = await xmtpClient.conversations.list();

        allConversations.forEach(async (conv) => {
          const fetchedMessages = await conv.messages();
          fetchedMessages.sort((a, b) => Number(a.sentAtNs) - Number(b.sentAtNs));

          setMessages((prev) => {
            if (selectedConversation && conv.id === selectedConversation.id) {
              const existingIds = new Set(prev.map((m) => m.id));
              const newUnique = fetchedMessages.filter((m) => !existingIds.has(m.id));
              return [...prev, ...newUnique];
            } else {
              // Increment unread count for other conversations
              setUnreadCounts((prevCounts) => ({
                ...prevCounts,
                [conv.id]: (prevCounts[conv.id] || 0) + 1,
              }));
              return prev;
            }
          });
        });

        // Update the conversations list (in case new conversations were added)
        setConversations(allConversations);
      } catch (err) {
        console.error('Error during polling:', err);
        setError('Error fetching new messages.');
      }
    };

    // Initial poll
    pollNewMessages();

    // Set up interval polling
    pollingIntervalRef.current = setInterval(pollNewMessages, POLLING_INTERVAL_MS);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [xmtpClient, selectedConversation]);

  // Function to handle displaying message content with fallback
  const getDisplayContent = (msg) => {
    if (!msg) return '';

    // Safely handle unsupported content types via fallback
    const codec = xmtpClient?.codecFor?.(msg.contentType);
    if (!codec) {
      // Not supported content type
      if (msg.fallback !== undefined) {
        return msg.fallback;
      }
      // If there's no fallback (e.g., read receipts), hide them
      return '';
    }
    // Otherwise, it’s supported. Show its contents.
    return msg.content;
  };

  // Function to convert sentAtNs to Date
  const convertSentAtNsToDate = (sentAtNs) => {
    if (typeof sentAtNs !== 'bigint') return undefined;
    // Convert nanoseconds to milliseconds
    const ms = Number(sentAtNs) / 1e6;
    return new Date(ms);
  };

  // Function to send a new message
  const sendMessage = async () => {
    if (!selectedConversation || !messageText.trim()) return;
    try {
      await selectedConversation.send(messageText.trim());
      setMessageText('');
      // Rely on polling to refresh and fetch the sent message
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  // Function to select a conversation
  const selectConversation = async (conv) => {
    setSelectedConversation(conv);
    setMessages([]);
    await fetchMessages(conv);

    // Reset unread count for the selected conversation
    setUnreadCounts((prevCounts) => ({
      ...prevCounts,
      [conv.id]: 0,
    }));
  };

  return (
    <div className="chat-container">
      {/* Side Panel: Conversations List */}
      <div className="conversations-list">
        <ListGroup>
          {conversations.map((conv) => {
            const address = conversationAddresses[conv.id] || 'Unknown';

            return (
              <ListGroup.Item
                key={conv.id}
                action
                active={selectedConversation && conv.id === selectedConversation.id}
                onClick={() => selectConversation(conv)}
                className="d-flex justify-content-between align-items-center"
              >
                {address}
                {unreadCounts[conv.id] > 0 && (
                  <Badge bg="primary" pill>
                    {unreadCounts[conv.id]}
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

              {messages.length === 0 ? (
                <p className="text-muted">No messages yet.</p>
              ) : (
                messages.map((msg) => {
                  // 1. Ensure the message belongs to this conversation
                  if (msg.conversationId !== selectedConversation.id) {
                    // Could log or skip
                    return null;
                  }

                  // 2. Check for required properties
                  if (
                    !msg.senderInboxId ||
                    !msg.contentType ||
                    typeof msg.content === 'undefined' ||
                    !msg.id ||
                    !msg.sentAtNs
                  ) {
                    console.warn(
                      'Encountered a message with missing properties:',
                      msg
                    );
                    return null;
                  }

                  // 3. Convert the ns timestamp
                  const sentDate = convertSentAtNsToDate(msg.sentAtNs);
                  const content = getDisplayContent(msg);
                  if (!content) {
                    // e.g., read receipts
                    return null;
                  }

                  // 4. Is it from me?
                  const isMe =
                    xmtpClient.inboxId &&
                    msg.senderInboxId.toLowerCase() === xmtpClient.inboxId.toLowerCase();

                  return (
                    <div
                      className="message-row"
                      key={msg.id}
                      style={{
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        className={`message-bubble ${
                          isMe ? 'bubble-me' : 'bubble-them'
                        }`}
                      >
                        {content}
                        <div className="message-meta">
                          {sentDate
                            ? sentDate.toLocaleString()
                            : 'Unknown time'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer (Form to send messages) */}
            <div className="chat-footer">
              <Form.Group controlId="messageText" className="mb-2">
                <Form.Control
                  type="text"
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
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
