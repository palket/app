// src/App.jsx
import React, { useState, useEffect } from 'react';
import {
  ZeroAddress,
  BrowserProvider,
  Contract,
  parseUnits,
  formatUnits,
  toBigInt as ethersToBigInt, // Renamed to avoid conflict
  isAddress as ethersIsAddress,
} from 'ethers';
import PalketInfo from './palketInfo.json';

import {
  Container,
  Navbar,
  Nav,
  NavDropdown,
  Button,
  Form,
  Card,
  Row,
  Col,
  Alert,
  Spinner,
  Modal,
  Badge,
  Dropdown,
  DropdownButton,
  Tab,
  Tabs,
} from 'react-bootstrap';

import 'bootstrap/dist/css/bootstrap.min.css';

import { Link } from 'react-router-dom'; // Removed Router and Routes imports

import Linkify from 'react-linkify';

import { Client, ConsentEntityType, ConsentState  } from '@xmtp/browser-sdk';

import { toBytes } from 'viem/utils';

import Chat from './Chat';

// Removed React Router components
// import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';

const xmtpEnv = 'dev';

// AddressLink Component
const AddressLink = ({ address, onChat, onSelectMenu, onSetProfileAddress }) => {
  if (!address || !ethersIsAddress(address)) {
    return <span className="text-muted">Unknown Address</span>;
  }

  return (
    <span>
      <span
        style={{ cursor: 'pointer', color: '#0d6efd', textDecoration: 'underline' }}
        onClick={() => {
          // Switch to Profile tab
          onSelectMenu('Profile');
          // Load that user’s address in the profile view
          onSetProfileAddress(address);
        }}
      >
        {address.substring(0, 6)}...{address.substring(address.length - 4)}
      </span>
      <Button variant="link" size="sm" 
        onClick={() => {
          // Switch to Chat tab
          onSelectMenu('Chat');
          // Load that user’s chat
          onChat(address);
        }}
      >
        Chat
      </Button>
    </span>
  );
};

// Function to render star rating
const renderStarRating = (score) => {
  const totalStars = 5;
  const filledStars = score;

  const stars = [];
  for (let i = 1; i <= totalStars; i++) {
    stars.push(
      <span key={i} style={{ color: '#FFD700', fontSize: '1.2em' }}>
        {i <= filledStars ? '★' : '☆'}
      </span>
    );
  }

  return <span>{stars}</span>;
};

const linkifyOptions = {
  target: '_blank',
  rel: 'noopener noreferrer',
  componentDecorator: (decoratedHref, decoratedText, key) => (
    <a href={decoratedHref} key={key} target="_blank" rel="noopener noreferrer">
      {decoratedText}
    </a>
  ),
};

const ChooseParticipantModal = ({ show, onHide, participants, chooseParticipant, loading }) => {
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  const handleChoose = () => {
    if (selectedParticipant) {
      chooseParticipant(selectedParticipant);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Choose Participant</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {participants.length === 0 ? (
          <p>No participants found.</p>
        ) : (
          <Form.Group controlId="participantSelect">
            <Form.Label>Select Participant</Form.Label>
            <Form.Control
              as="select"
              onChange={(e) => setSelectedParticipant(e.target.value)}
            >
              <option value={''}>-- Select --</option>
              {participants.map((p, idx) => (
                <option key={idx} value={p.applicant}>
                  {p.applicant.substring(0, 6)}...{p.applicant.substring(p.applicant.length - 4)} |{' '}
                  {p.bidPrice > 0 ? ` Bid: ${p.bidPrice} USDC` : ''}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
        <Button variant="primary" onClick={handleChoose} disabled={!selectedParticipant || loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Choose'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Component for Finalize Offer Modal
const FinalizeOfferModal = ({ offerId, finalizeOffer, loading }) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedScore, setSelectedScore] = useState(5);

  const handleFinalize = () => {
    finalizeOffer(offerId, selectedScore);
    setShowModal(false);
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="mr-2 mt-2"
      >
        {loading ? <Spinner animation="border" size="sm" /> : 'Finalize Offer'}
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Finalize Offer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="scoreSelect">
            <Form.Label>Select a Score for the Sender</Form.Label>
            <Form.Control
              as="select"
              value={selectedScore}
              onChange={(e) => setSelectedScore(Number(e.target.value))}
            >
              <option value={1}>One Star</option>
              <option value={2}>Two Stars</option>
              <option value={3}>Three Stars</option>
              <option value={4}>Four Stars</option>
              <option value={5}>Five Stars</option>
            </Form.Control>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={handleFinalize} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Finalize'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

// Helper functions to get offer state and badge variants
function getOfferState(state) {
  switch (state) {
    case 0:
      return 'Created';
    case 1:
      return 'Accepted';
    case 2:
      return 'Finalized';
    case 3:
      return 'Cancelled';
    case 4:
      return 'Forfeited';
    default:
      return 'Unknown';
  }
}

function getBadgeVariant(state) {
  switch (state) {
    case 0:
      return 'success'; // Created
    case 1:
      return 'info'; // Accepted
    case 2:
      return 'dark'; // Finalized
    case 3:
      return 'danger'; // Cancelled
    case 4:
      return 'warning'; // Forfeited
    default:
      return 'light'; // Unknown
  }
}

const RequestParticipationModal = ({ show, onHide, loading, requestParticipation, offerType }) => {
  const [bidValue, setBidValue] = useState('');

  const handleRequest = () => {
    requestParticipation(bidValue);
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Request Participation</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {offerType === 0 ? (
          <Form.Group controlId="bidValue">
            <Form.Label>Your Bid Price (USDC)</Form.Label>
            <Form.Control
              type="number"
              placeholder="Enter your proposed price"
              min="0.01"
              step="0.01"
              value={bidValue}
              onChange={(e) => setBidValue(e.target.value)}
            />
          </Form.Group>
        ) : (
          <p>Click "Request" to participate. No bid needed for Sender-Initiated offers.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
        <Button
          variant="primary"
          onClick={handleRequest}
          disabled={loading || (offerType === 0 && (!bidValue || parseFloat(bidValue) <= 0))}
        >
          {loading ? <Spinner animation="border" size="sm" /> : 'Request'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// ConfirmTransactionModal: A generic modal to confirm a USDC transfer
const ConfirmTransactionModal = ({ show, onHide, amount, onConfirm, loading }) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Confirm Transaction</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          You are about to transfer <strong>{amount}</strong> USDC. Are you sure you want to proceed?
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Confirm'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// OfferCard Component
const OfferCard = ({
  offer,
  usdcDecimals,
  account,
  loading,
  cancelOffer,
  finalizeOffer,
  forfeitOffer,
  hideActions = false,
  averageScore,
  requestParticipationForOffer,
  canChooseParticipantForOffer,
  isExpired,
  onChat,
  onSelectMenu,
  onSetProfileAddress,
}) => {
  const offerTypeText = offer.offerType === 0 ? 'PRODUCT REQUEST' : 'PRODUCT OFFER';
  const formattedCreationTime = new Date(offer.creationTime * 1000).toLocaleString();
  const formattedAcceptanceTime = offer.acceptanceTime
    ? new Date(offer.acceptanceTime * 1000).toLocaleString()
    : 'Not Accepted Yet';

  const canCancelOffer = () => {
    if (offer.state !== 0) return false;
    if (offer.offerType === 0) {
      return offer.receiver.toLowerCase() === account.toLowerCase();
    } else {
      return offer.sender.toLowerCase() === account.toLowerCase();
    }
  };

  return (
    <Card className="mb-4 w-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center">
          <Card.Title>Offer {offer.offerId}</Card.Title>
          {offer.state === 2 && <Badge bg="secondary">{renderStarRating(offer.senderScore)}</Badge>}
          {offer.state === 0 && offer.offerType === 0 && <Badge bg="primary"> {offerTypeText} </Badge>}
          {offer.state === 0 && offer.offerType === 1 && <Badge bg="secondary"> {offerTypeText} </Badge>}
          <Badge bg={getBadgeVariant(offer.state)}>{getOfferState(offer.state)}</Badge>
        </div>
        <Card.Text>
          <Linkify options={linkifyOptions}>{offer.productDescription}</Linkify>
        </Card.Text>
        <Card.Text>
          <strong>{parseFloat(formatUnits(offer.productValue, usdcDecimals)).toFixed(2)} USDC</strong>
        </Card.Text>
        <Card.Text>
          Receiver: <AddressLink address={offer.receiver} onChat={onChat}  onSelectMenu={onSelectMenu} onSetProfileAddress={onSetProfileAddress}/>
        </Card.Text>
        <Card.Text>
          Sender: <AddressLink address={offer.sender} onChat={onChat}  onSelectMenu={onSelectMenu}  onSetProfileAddress={onSetProfileAddress} /> <span>(Avg Score: {averageScore})</span>
        </Card.Text>
        <Card.Text>Created: {formattedCreationTime}</Card.Text>
        {offer.state !== 0 && offer.state !== 3 && <Card.Text>Accepted: {formattedAcceptanceTime}</Card.Text>}

        {!hideActions && (
          <>
            {offer.state === 0 &&
              ((offer.offerType === 0 && offer.receiver.toLowerCase() !== account.toLowerCase()) ||
                (offer.offerType === 1 && offer.sender.toLowerCase() !== account.toLowerCase())) && (
                <Button
                  variant="success"
                  onClick={() => requestParticipationForOffer(offer)}
                  disabled={loading}
                  className="mr-2 mt-2"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Request Participation'}
                </Button>
              )}

            {offer.state === 0 &&
              ((offer.offerType === 0 && offer.receiver.toLowerCase() === account.toLowerCase()) ||
                (offer.offerType === 1 && offer.sender.toLowerCase() === account.toLowerCase())) && (
                <Button
                  variant="primary"
                  onClick={() => canChooseParticipantForOffer(offer)}
                  disabled={loading}
                  className="mr-2 mt-2"
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Choose Participant'}
                </Button>
              )}

            {canCancelOffer() && (
              <Button
                variant="danger"
                onClick={() => cancelOffer(offer.offerId)}
                disabled={loading}
                className="mr-2 mt-2"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Cancel Offer'}
              </Button>
            )}

            {offer.state === 1 && offer.receiver.toLowerCase() === account.toLowerCase() && (
              <FinalizeOfferModal
                offerId={offer.offerId}
                finalizeOffer={finalizeOffer}
                loading={loading}
              />
            )}

            {isExpired && (
              <Button
                variant="warning"
                onClick={() => forfeitOffer(offer.offerId)}
                disabled={loading}
                className="mt-2"
              >
                {loading ? <Spinner animation="border" size="sm" /> : 'Forfeit Offer'}
              </Button>
            )}
          </>
        )}
      </Card.Body>
    </Card>

  );

};

// Home Component
const Home = () => {
  return null;
};

// UserProfile Component (New)
const UserProfile = ({
  marketplaceContract,
  usdcDecimals,
  account,
  userAddress,
  setShowDescriptionModal,
  onChat,
  onSelectMenu,
  onSetProfileAddress,
}) => {
  const [userProfile, setUserProfile] = useState(null);
  const [userOffersAsSender, setUserOffersAsSender] = useState([]);
  const [userOffersAsReceiver, setUserOffersAsReceiver] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (marketplaceContract && userAddress) {
      fetchUserInfo();
      fetchUserOffers();
    }
  }, [marketplaceContract, userAddress]);

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const profile = await marketplaceContract.userProfiles(userAddress);
      const totalScore = Number(profile.totalScoreAsSender);
      const numFinalizedAsSender = Number(profile.numOffersFinalizedAsSender);
      const averageScoreAsSender =
        numFinalizedAsSender > 0 ? parseFloat(totalScore / numFinalizedAsSender).toFixed(2) : 'N/A';

      setUserProfile({
        descriptionAsSender: profile.descriptionAsSender,
        averageScoreAsSender: averageScoreAsSender,
        numOffersAcceptedAsSender: Number(profile.numOffersAcceptedAsSender),
        numOffersFinalizedAsSender: numFinalizedAsSender,
        numOffersAcceptedAsReceiver: Number(profile.numOffersAcceptedAsReceiver),
        numOffersFinalizedAsReceiver: Number(profile.numOffersFinalizedAsReceiver),
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching user information: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserOffers = async () => {
    try {
      setLoading(true);
      const offerCount = await marketplaceContract.offerCount();
      const tempUserOffersAsSender = [];
      const tempUserOffersAsReceiver = [];

      for (let offerId = 1; offerId <= offerCount; offerId++) {
        const offer = await marketplaceContract.offers(offerId);
        const offerSender = offer.sender.toLowerCase();
        const offerReceiver = offer.receiver.toLowerCase();
        const userAddressLower = userAddress.toLowerCase();

        const offerObj = {
          offerId: Number(offer.offerId),
          receiver: offer.receiver,
          sender: offer.sender,
          productDescription: offer.productDescription,
          productValue: offer.productValue,
          deposit: offer.deposit,
          state: Number(offer.state),
          offerType: Number(offer.offerType),
          creationTime: Number(offer.creationTime),
          acceptanceTime: Number(offer.acceptanceTime),
          senderScore: Number(offer.senderScore),
        };

        if (offerSender === userAddressLower) {
          tempUserOffersAsSender.push(offerObj);
        }
        if (offerReceiver === userAddressLower) {
          tempUserOffersAsReceiver.push(offerObj);
        }
      }

      setUserOffersAsSender(tempUserOffersAsSender);
      setUserOffersAsReceiver(tempUserOffersAsReceiver);
    } catch (error) {
      console.error('Error fetching user offers:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching user offers: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-4">
      {message && (
        <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      )}

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : userProfile ? (
        <>
          <Card className="mb-4">
            <Card.Header>
              <h3>
                User Profile <Badge bg="secondary">{userAddress}</Badge>
              </h3>
            </Card.Header>
            <Card.Body>
              <Tabs defaultActiveKey="sender" id="user-offers-tabs" className="mb-3">
                <Tab eventKey="sender" title="Sender Profile">
                  <Card className="mb-4">
                    <Card.Body>
                      <Card.Text>
                        <strong>Description:</strong> {userProfile.descriptionAsSender || 'No description provided.'}
                      </Card.Text>
                      <Card.Text>
                        <strong>Average Score:</strong>{' '}
                        {userProfile.averageScoreAsSender !== 'N/A' ? (
                          <>
                            {renderStarRating(parseFloat(userProfile.averageScoreAsSender))} ({userProfile.averageScoreAsSender})
                          </>
                        ) : (
                          'N/A'
                        )}
                      </Card.Text>
                      <Card.Text>
                        <strong>Offers Accepted:</strong> {userProfile.numOffersAcceptedAsSender}
                      </Card.Text>
                      <Card.Text>
                        <strong>Offers Finalized:</strong> {userProfile.numOffersFinalizedAsSender}
                      </Card.Text>
                      {userAddress.toLowerCase() === account.toLowerCase() && (
                        <Button
                          variant="primary"
                          onClick={() => setShowDescriptionModal(true)}
                          className="mt-3"
                        >
                          Set Description
                        </Button>
                      )}
                    </Card.Body>
                  </Card>

                  {userOffersAsSender.length > 0 ? (
                    <Row className="g-4">
                      {userOffersAsSender.map((offer, index) => (
                        <Col key={index} lg={12} md={12} sm={12}>
                          <OfferCard
                            offer={offer}
                            usdcDecimals={usdcDecimals}
                            account={account}
                            loading={false}
                            cancelOffer={() => {}}
                            finalizeOffer={() => {}}
                            forfeitOffer={() => {}}
                            hideActions
                            averageScore={offer.averageScore}
                            requestParticipationForOffer={() => {}}
                            canChooseParticipantForOffer={() => {}}
                            isExpired={false}
                            onChat={onChat}
                            onSelectMenu={onSelectMenu}
                            onSetProfileAddress={onSetProfileAddress}
                          />
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <p className="text-muted">No offers found where this user is the sender.</p>
                  )}
                </Tab>

                <Tab eventKey="receiver" title="Receiver Profile">
                  <Card className="mb-4">
                    <Card.Body>
                      <Card.Text>
                        <strong>Offers Accepted:</strong> {userProfile.numOffersAcceptedAsReceiver}
                      </Card.Text>
                      <Card.Text>
                        <strong>Offers Finalized:</strong> {userProfile.numOffersFinalizedAsReceiver}
                      </Card.Text>
                    </Card.Body>
                  </Card>

                  {userOffersAsReceiver.length > 0 ? (
                    <Row className="g-4">
                      {userOffersAsReceiver.map((offer, index) => (
                        <Col key={index} lg={12} md={12} sm={12}>
                          <OfferCard
                            offer={offer}
                            usdcDecimals={usdcDecimals}
                            account={account}
                            loading={false}
                            cancelOffer={() => {}}
                            finalizeOffer={() => {}}
                            forfeitOffer={() => {}}
                            hideActions
                            averageScore={offer.averageScore}
                            requestParticipationForOffer={() => {}}
                            canChooseParticipantForOffer={() => {}}
                            isExpired={false}
                            onChat={onChat}
                            onSelectMenu={onSelectMenu}
                            onSetProfileAddress={onSetProfileAddress}
                          />
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <p className="text-muted">No offers found where this user is the receiver.</p>
                  )}
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </>
      ) : (
        <p className="text-muted">No profile information available.</p>
      )}
    </Container>
  );

  // Removed UserInfo component as it's now handled within the same page
};

function App() {
  const [networkEnv, setNetworkEnv] = useState('sepolia');
  const networkKeys = Object.keys(PalketInfo.networks);
  const {
    chainId,
    name: networkName,
    isTestnet,
    currencyName,
    currencySymbol,
    currencyDecimals,
    rpcUrl,
    blockExplorerUrl,
    palketaddress,
    usdcaddress,
    palketabi,
    usdcabi,
  } = PalketInfo.networks[networkEnv];

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [marketplaceContract, setMarketplaceContract] = useState(null);
  const [depositPercentage, setDepositPercentage] = useState(null);
  const [finalizeFeePercentage, setFinalizeFeePercentage] = useState(null);
  const [usdcContract, setUsdcContract] = useState(null);
  const [usdcDecimals, setUsdcDecimals] = useState(null);
  const [account, setAccount] = useState('');
  const [allOffers, setAllOffers] = useState([]);
  const [formValues, setFormValues] = useState({
    productDescription: '',
    productValue: '',
    offerType: 'ReceiverInitiated',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [userDescription, setUserDescription] = useState('');
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState(null);
  const [nativeBalance, setNativeBalance] = useState(null);
  const [mintAmount, setMintAmount] = useState('');
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintLoading, setMintLoading] = useState(false);
  const [filterType, setFilterType] = useState('All');
  const [filterState, setFilterState] = useState('All');

  const [xmtpClient, setXmtpClient] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [currentOfferForParticipation, setCurrentOfferForParticipation] = useState(null);

  const [showChooseModal, setShowChooseModal] = useState(false);
  const [currentOfferForChoosing, setCurrentOfferForChoosing] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [encryptionKeyInput, setEncryptionKeyInput] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');

  // State for ConfirmTransactionModal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmCallback, setConfirmCallback] = useState(null);

  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  // Added loadingParticipants state
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [currentChatAddress, setCurrentChatAddress] = useState(null);
  const [selectedProfileAddress, setSelectedProfileAddress] = useState(null); // New state for user profiles

  const [selectedMenu, setSelectedMenu] = useState('Buy');

  useEffect(() => {
    initNetwork();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [networkEnv]);

  useEffect(() => {
    if (marketplaceContract && account) {
      loadOffers(marketplaceContract);
      loadUserDescription();
      loadContractParams();
    }
  }, [marketplaceContract, account]);

  useEffect(() => {
    loadUsdcBalance();
    loadNativeBalance();
  }, [usdcContract, account, usdcDecimals, provider]);

  useEffect(() => {
    if (account) {
      setSelectedProfileAddress(account);
    }
  }, [account]);

  const onChat = (address) => {
    setCurrentChatAddress(address);
    handleChatInitialization();
  };

  const loadContractParams = async () => {
    try {
      const dp = await marketplaceContract.depositPercentage();
      const ff = await marketplaceContract.finalizeFeePercentage();
      setDepositPercentage(Number(dp)); // e.g., 50
      setFinalizeFeePercentage(Number(ff)); // e.g., 1
    } catch (error) {
      console.error('Error fetching contract params:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching contract parameters: ' + (error.reason || error.message),
      });
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      setAccount('');
      setUsdcBalance(null);
      setNativeBalance(null);
    } else {
      await connectWallet();
    }
  };

  const handleChainChanged = () => {
    console.log('Chain changed detected. Reload application.');
    // Optionally, you can reload the page or handle it gracefully
    // window.location.reload();
  };

  const switchNetworkIfNeeded = async () => {
    if (isSwitchingNetwork) {
      console.log('Network switch already in progress.');
      return;
    }

    setIsSwitchingNetwork(true);

    if (!window.ethereum) {
      console.log('MetaMask is not installed.');
      setMessage({
        type: 'danger',
        text: 'MetaMask is not installed. Please install it to use this app.',
      });
      setIsSwitchingNetwork(false);
      return;
    }

    try {
      const chainIdCurrent = await window.ethereum.request({ method: 'eth_chainId' });
      console.log(`Current chainId: ${chainIdCurrent}`);
      console.log(`Desired chainId: ${chainId}`);

      if (chainIdCurrent.toLowerCase() === chainId.toLowerCase()) {
        console.log('Already on the desired network.');
        setIsSwitchingNetwork(false);
        return;
      }

      console.log(`Attempting to switch to chainId: ${chainId}`);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
      console.log('Successfully switched network.');
    } catch (switchError) {
      console.error('Error switching network:', switchError);

      if (switchError.code === 4902) {
        // Chain not added to MetaMask
        console.log('Network not found in MetaMask. Attempting to add it.');
        const params = {
          chainId,
          chainName: networkName,
          rpcUrls: [rpcUrl],
          nativeCurrency: {
            name: currencyName,
            symbol: currencySymbol,
            decimals: parseInt(currencyDecimals),
          },
        };
        if (blockExplorerUrl && blockExplorerUrl.startsWith('https://')) {
          params.blockExplorerUrls = [blockExplorerUrl];
        }
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [params],
          });
          console.log('Network added successfully.');
        } catch (addError) {
          console.error('Error adding network:', addError);
          setMessage({
            type: 'danger',
            text: `Error adding network: ${addError.message || addError}`,
          });
        }
      } else {
        // Handle other errors
        setMessage({
          type: 'danger',
          text: `Error switching network: ${switchError.message || switchError}`,
        });
      }
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  // This runs automatically when networkEnv changes (e.g., user chooses from dropdown).
  // We also call it the first time on mount.
  const initNetwork = async () => {
    await switchNetworkIfNeeded();
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        setLoading(false);
        return;
      }

      console.log('Attempting to switch network if needed before connecting.');
      await switchNetworkIfNeeded();

      console.log('Requesting account access.');
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const tempProvider = new BrowserProvider(window.ethereum);
      const tempSigner = await tempProvider.getSigner();
      const tempAccount = await tempSigner.getAddress();
      console.log(`Connected account: ${tempAccount}`);

      // Double-check chain after user connected
      const chainIdCurrent = await window.ethereum.request({ method: 'eth_chainId' });
      console.log(`ChainId after connection: ${chainIdCurrent}`);
      if (chainIdCurrent.toLowerCase() !== chainId.toLowerCase()) {
        // If still not on correct chain, show an error
        setMessage({
          type: 'warning',
          text: `You must switch to ${networkName} to proceed.`,
        });
        return;
      }

      const tempMarketplaceContract = new Contract(palketaddress, palketabi, tempSigner);
      const tempUsdcContract = new Contract(usdcaddress, usdcabi, tempSigner);
      const tempUsdcDecimals = await tempUsdcContract.decimals();

      setProvider(tempProvider);
      setSigner(tempSigner);
      setAccount(tempAccount);
      setMarketplaceContract(tempMarketplaceContract);
      setUsdcContract(tempUsdcContract);
      setUsdcDecimals(tempUsdcDecimals);

      console.log('Loading offers and user description.');
      await loadOffers(tempMarketplaceContract);
      await loadUserDescription();
      console.log('Wallet connected successfully.');
      handleChatInitialization();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setMessage({
        type: 'danger',
        text: `Error connecting wallet: ${error.message || error}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const changeAccount = async () => {
    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } else {
        setMessage({ type: 'danger', text: 'MetaMask is not installed.' });
      }
    } catch (error) {
      console.error('Error changing account:', error);
      setMessage({
        type: 'danger',
        text: 'Error changing account: ' + (error.reason || error.message),
      });
    }
  };

  const loadUsdcBalance = async () => {
    try {
      if (usdcContract && account && usdcDecimals !== null) {
        const balance = await usdcContract.balanceOf(account);
        const formattedBalance = parseFloat(formatUnits(balance, usdcDecimals)).toFixed(2);
        setUsdcBalance(formattedBalance);
      }
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching USDC balance: ' + (error.reason || error.message),
      });
    }
  };

  const loadNativeBalance = async () => {
    try {
      if (provider && account) {
        const balance = await provider.getBalance(account);
        const formattedBalance = parseFloat(formatUnits(balance, parseInt(currencyDecimals))).toFixed(4);
        setNativeBalance(formattedBalance);
      }
    } catch (error) {
      console.error('Error fetching native balance:', error);
      setMessage({
        type: 'danger',
        text: 'Error fetching native balance: ' + (error.reason || error.message),
      });
    }
  };

  const handleMintUSDC = async (e) => {
    e.preventDefault();
    try {
      if (!mintAmount || isNaN(mintAmount) || parseFloat(mintAmount) <= 0) {
        setMessage({ type: 'danger', text: 'Please enter a valid mint amount.' });
        return;
      }

      const recipient = mintRecipient.trim() === '' ? account : mintRecipient.trim();
      const amountInWei = parseUnits(mintAmount, usdcDecimals);

      setMintLoading(true);
      const tx = await usdcContract.mint(recipient, amountInWei);
      await tx.wait();

      setMessage({
        type: 'success',
        text: `Successfully minted ${mintAmount} USDC to ${recipient}.`,
      });
      setMintAmount('');
      setMintRecipient('');
      await loadUsdcBalance();
    } catch (error) {
      console.error('Error minting USDC:', error);
      setMessage({
        type: 'danger',
        text: 'Error minting USDC: ' + (error.reason || error.message),
      });
    } finally {
      setMintLoading(false);
    }
  };

  const loadOffers = async (contract) => {
    try {
      setLoading(true);
      const tempAllOffers = [];
      const offerCount = await contract.offerCount();

      const userStats = {};
      for (let offerId = 1; offerId <= offerCount; offerId++) {
        const offer = await contract.offers(offerId);
        const offerObj = {
          offerId: Number(offer.offerId),
          receiver: offer.receiver,
          sender: offer.sender,
          productDescription: offer.productDescription,
          productValue: offer.productValue,
          deposit: offer.deposit,
          state: Number(offer.state),
          offerType: Number(offer.offerType),
          creationTime: Number(offer.creationTime),
          acceptanceTime: Number(offer.acceptanceTime),
          senderScore: Number(offer.senderScore),
        };

        tempAllOffers.push(offerObj);
      }

      // Collect average scores for all senders
      for (let offer of tempAllOffers) {
        const senderAddress = offer.sender.toLowerCase();
        if (senderAddress !== ZeroAddress.toLowerCase()) {
          if (!userStats[senderAddress]) {
            const profile = await contract.userProfiles(senderAddress);
            const totalScore = Number(profile.totalScoreAsSender);
            const numFinalized = Number(profile.numOffersFinalizedAsSender);
            const averageScore = numFinalized > 0 ? parseFloat(totalScore / numFinalized).toFixed(2) : 'N/A';
            userStats[senderAddress] = { averageScore };
          }
        }
      }

      // Attach averageScore to each offer
      const enrichedAllOffers = tempAllOffers.map((offer) => {
        const senderAddress = offer.sender.toLowerCase();
        return {
          ...offer,
          averageScore: userStats[senderAddress]?.averageScore || 'N/A',
        };
      });

      setAllOffers(enrichedAllOffers);
    } catch (error) {
      console.error('Error loading offers:', error);
      setMessage({
        type: 'danger',
        text: 'Error loading offers: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserDescription = async () => {
    try {
      if (!marketplaceContract || !account) return;
      const profile = await marketplaceContract.userProfiles(account);
      setUserDescription(profile.descriptionAsSender);
    } catch (error) {
      console.error('Error loading user description:', error);
      setMessage({
        type: 'danger',
        text: 'Error loading description: ' + (error.reason || error.message),
      });
    }
  };

  const handleInputChange = (e) => {
    setFormValues({ ...formValues, [e.target.name]: e.target.value });
  };

  // Updated createOffer to account for depositPercentage from the contract
  const createOffer = async (offerType) => {
    try {
      setLoading(true);
      const { productDescription, productValue } = formValues;

      if (!productDescription) {
        setMessage({ type: 'danger', text: 'Please provide a product description.' });
        setLoading(false);
        return;
      }

      if (offerType === 'ReceiverInitiated') {
        // No upfront USDC transfer from the receiver
        const tx = await marketplaceContract.createOfferByReceiver(productDescription);
        await tx.wait();

        setMessage({ type: 'success', text: 'Offer created successfully!' });
        setFormValues({ productDescription: '', productValue: '', offerType: 'ReceiverInitiated' });
        await loadOffers(marketplaceContract);
        await loadUsdcBalance();
        await loadNativeBalance();
      } else {
        // Sender Initiated -> deposit = depositPercentage% of productValue
        if (!productValue || parseFloat(productValue) <= 0) {
          setMessage({ type: 'danger', text: 'Please provide a valid product value.' });
          setLoading(false);
          return;
        }

        const productValueString = productValue.toString();
        const valueInWei = parseUnits(productValueString, usdcDecimals);
        const valueInBigInt = ethersToBigInt(valueInWei);

        // Check depositPercentage from contract
        const dp = await marketplaceContract.depositPercentage(); // e.g., 50
        const deposit = (valueInBigInt * BigInt(dp)) / BigInt(100);
        const depositUSDC = parseFloat(formatUnits(deposit, usdcDecimals)).toFixed(2);

        // Show confirmation modal for the deposit
        setConfirmAmount(depositUSDC);
        setShowConfirmModal(true);

        // Set the callback to execute upon confirmation
        setConfirmCallback(() => async () => {
          setLoading(true);

          // Ensure user has approved enough USDC for the deposit
          const currentAllowance = await usdcContract.allowance(account, palketaddress);
          if (currentAllowance < deposit) {
            const approveTx = await usdcContract.approve(palketaddress, deposit);
            await approveTx.wait();
          }

          const tx = await marketplaceContract.createOfferBySender(
            productDescription,
            productValueString
          );
          await tx.wait();

          setMessage({ type: 'success', text: 'Offer created successfully!' });
          setFormValues({ productDescription: '', productValue: '', offerType: 'ReceiverInitiated' });
          await loadOffers(marketplaceContract);
          await loadUsdcBalance();
          await loadNativeBalance();
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      setMessage({
        type: 'danger',
        text: 'Error creating offer: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelOffer = async (offerId) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.cancelOffer(offerId);
      await tx.wait();

      setMessage({ type: 'success', text: 'Offer cancelled successfully!' });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
      await loadNativeBalance();
    } catch (error) {
      console.error('Error cancelling offer:', error);
      setMessage({
        type: 'danger',
        text: 'Error cancelling offer: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const finalizeOffer = async (offerId, score) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.finalizeOffer(offerId, score);
      await tx.wait();

      setMessage({ type: 'success', text: 'Offer finalized successfully!' });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
      await loadNativeBalance();
    } catch (error) {
      console.error('Error finalizing offer:', error);
      setMessage({
        type: 'danger',
        text: 'Error finalizing offer: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserDescription = async () => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.setUserDescription(userDescription);
      await tx.wait();

      setMessage({ type: 'success', text: 'Description updated successfully!' });
      setShowDescriptionModal(false);
      await loadUserDescription();
    } catch (error) {
      console.error('Error updating description:', error);
      setMessage({
        type: 'danger',
        text: 'Error updating description: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const forfeitOffer = async (offerId) => {
    try {
      setLoading(true);
      const tx = await marketplaceContract.forfeitOffer(offerId);
      await tx.wait();

      setMessage({ type: 'success', text: `Offer ${offerId} forfeited successfully!` });
      await loadOffers(marketplaceContract);
      await loadUsdcBalance();
      await loadNativeBalance();
    } catch (error) {
      console.error(`Error forfeiting offer ${offerId}:`, error);
      setMessage({
        type: 'danger',
        text: `Error forfeiting offer ${offerId}: ` + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForfeitExpiredOffers = async () => {
    try {
      setLoading(true);
      const currentTime = Math.floor(Date.now() / 1000);
      const expiredOffers = allOffers.filter(
        (offer) =>
          offer.state === 1 &&
          offer.acceptanceTime + 180 * 24 * 60 * 60 <= currentTime
      );

      if (expiredOffers.length === 0) {
        setMessage({ type: 'info', text: 'No expired offers to forfeit.' });
        return;
      }

      for (let offer of expiredOffers) {
        await forfeitOffer(offer.offerId);
      }
    } catch (error) {
      console.error('Error forfeiting expired offers:', error);
      setMessage({
        type: 'danger',
        text: 'Error forfeiting expired offers: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const requestParticipationForOffer = (offer) => {
    setCurrentOfferForParticipation(offer);
    setShowRequestModal(true);
  };

  // Updated to show a confirmation for the locked deposit rather than a fixed 0.5 or 1.5 factor
  const handleRequestParticipation = async (bidValue) => {
    try {
      setLoading(true);
      const offer = currentOfferForParticipation;
      let totalAmount;
      if (offer.offerType === 0) {
        // ReceiverInitiated => participant provides bidPrice + deposit (= depositPercentage% of bidPrice)
        const bidInWei = parseUnits(bidValue, usdcDecimals);
        const dp = await marketplaceContract.depositPercentage();
        const deposit = (ethersToBigInt(bidInWei) * BigInt(dp)) / BigInt(100);
        totalAmount = bidInWei + deposit;
      } else {
        // SenderInitiated => participant must lock productValue + deposit
        totalAmount = offer.productValue + offer.deposit;
      }

      const totalUSDC = parseFloat(formatUnits(totalAmount, usdcDecimals)).toFixed(2);

      // Show confirmation modal
      setConfirmAmount(totalUSDC);
      setShowConfirmModal(true);
      setConfirmCallback(() => async () => {
        setLoading(true);
        // Approve if needed, then requestParticipation
        const allowance = await usdcContract.allowance(account, palketaddress);
        if (allowance < totalAmount) {
          const approveTx = await usdcContract.approve(palketaddress, totalAmount);
          await approveTx.wait();
        }

        // **Provide Consent to the Counterpart User**
        await xmtpClient.setConsentStates([
          {
            entity: offer.offerType === 0 ? offer.receiver : offer.sender,
            entityType: ConsentEntityType.Address,
            state: ConsentState.allowed,
          },
        ]);

        const tx = await marketplaceContract.requestParticipation(
          offer.offerId,
          offer.offerType === 0 ? bidValue : 0 // pass the bidValue if ReceiverInitiated, or 0 for SenderInitiated
        );
        await tx.wait();

        setMessage({ type: 'success', text: 'Participation requested successfully!' });
        setShowRequestModal(false);
        setCurrentOfferForParticipation(null);
        await loadOffers(marketplaceContract);
        await loadUsdcBalance();
        await loadNativeBalance();
      });
    } catch (error) {
      console.error('Error requesting participation:', error);
      setMessage({
        type: 'danger',
        text: 'Error requesting participation: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  const canChooseParticipantForOffer = async (offer) => {
    setCurrentOfferForChoosing(offer);
    setShowChooseModal(true);
    await loadParticipantsForOffer(offer.offerId);
  };

  const loadParticipantsForOffer = async (offerId) => {
    setLoadingParticipants(true);
    try {
      let arr = [];
      let i = 0;
      while (true) {
        try {
          const p = await marketplaceContract.participationRequests(offerId, i);
          const applicant = p[0];
          const bidPrice = Number(p[2]);
          const bidPriceFormatted = bidPrice > 0 ? parseFloat(formatUnits(bidPrice, usdcDecimals)).toFixed(2) : 0;
          arr.push({ applicant, bidPrice: bidPriceFormatted });
          i++;
        } catch (error) {
          break;
        }
      }
      setParticipants(arr);
    } catch (error) {
      console.error('Error loading participants:', error);
      setMessage({ type: 'danger', text: 'Error loading participants: ' + (error.reason || error.message) });
    } finally {
      setLoadingParticipants(false);
    }
  };

  // Updated chooseParticipant to handle deposit dynamically
  const chooseParticipant = async (participantAddress) => {
    try {
      setLoading(true);
      const offerId = currentOfferForChoosing.offerId;

      let totalAmount = 0n;
      if (currentOfferForChoosing.offerType === 0) {
        // ReceiverInitiated => receiver must lock P+D for the chosen participant
        const chosenPart = participants.find((p) => p.applicant.toLowerCase() === participantAddress.toLowerCase());
        if (!chosenPart) {
          setMessage({ type: 'danger', text: 'Chosen participant not found.' });
          return;
        }
        const bidWei = parseUnits(chosenPart.bidPrice.toString(), usdcDecimals);
        const dp = await marketplaceContract.depositPercentage();
        const deposit = (ethersToBigInt(bidWei) * BigInt(dp)) / BigInt(100);
        totalAmount = bidWei + deposit;
      } else {
        // SenderInitiated => no extra from the sender upon choosing
        totalAmount = 0n;
      }

      const totalUSDC = parseFloat(formatUnits(totalAmount, usdcDecimals)).toFixed(2);

      if (totalAmount > 0n) {
        setConfirmAmount(totalUSDC);
        setShowConfirmModal(true);
        setConfirmCallback(() => async () => {
          setLoading(true);
          const allowance = await usdcContract.allowance(account, palketaddress);
          if (allowance < totalAmount) {
            const approveTx = await usdcContract.approve(palketaddress, totalAmount);
            await approveTx.wait();
          }
          
          // **Provide Consent to the Counterpart User**
          await xmtpClient.setConsentStates([
            {
              entity: participantAddress,
              entityType: ConsentEntityType.Address,
              state: ConsentState.Allowed,
            },
          ]);

          const tx = await marketplaceContract.chooseParticipant(offerId, participantAddress);
          await tx.wait();

          setMessage({ type: 'success', text: 'Participant chosen successfully!' });
          setShowChooseModal(false);
          setCurrentOfferForChoosing(null);
          setParticipants([]);
          await loadOffers(marketplaceContract);
          await loadUsdcBalance();
          await loadNativeBalance();
        });
      } else {
        // No extra USDC transfer from the chooser
        const tx = await marketplaceContract.chooseParticipant(offerId, participantAddress);
        await tx.wait();

        setMessage({ type: 'success', text: 'Participant chosen successfully!' });
        setShowChooseModal(false);
        setCurrentOfferForChoosing(null);
        setParticipants([]);
        await loadOffers(marketplaceContract);
        await loadUsdcBalance();
        await loadNativeBalance();
      }
    } catch (error) {
      console.error('Error choosing participant:', error);
      setMessage({
        type: 'danger',
        text: 'Error choosing participant: ' + (error.reason || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert hex to bytes
  function hexToBytes(hex) {
    if (hex.startsWith('0x')) {
      hex = hex.slice(2);
    }
    if (hex.length !== 64) {
      throw new Error('Hex string must be 64 characters (32 bytes)');
    }
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
      bytes.push(parseInt(hex.substring(c, c + 2), 16));
    }
    return new Uint8Array(bytes);
  }

  const initializeXmtp = async (encryptionKey) => {
    try {
      if (!provider) {
        throw new Error('No provider found, cannot initialize XMTP.');
      }
      if (!account) {
        throw new Error('No account found, cannot initialize XMTP.');
      }

      // Convert the user-input encryption key into bytes
      let encryptionBytes;
      try {
        encryptionBytes = hexToBytes(encryptionKey);
      } catch (hexError) {
        // Handle hex conversion errors separately
        console.error('Invalid hex key:', hexError.message);
        alert(`Invalid encryption key: ${hexError.message}`);
        return; // Stop initialization
      }

      // Create an XMTP-compatible Signer object
      const xmtpSigner = {
        getAddress: () => account,
        signMessage: async (message) => {
          // Use your ethers.js signer under the hood
          const signature = await signer.signMessage(message);
          // Convert the signature into bytes for XMTP
          return toBytes(signature);
        },
      };

      // Now create the XMTP client with that signer
      console.log('Creating XMTP client');
      const client = await Client.create(xmtpSigner, encryptionBytes, {
        env: xmtpEnv,
      });
      console.log('XMTP client created', client);
      // Store client in state
      setXmtpClient(client);
      setShowEncryptionModal(false);
      console.log('Modal should now be closed');
    } catch (error) {
      console.error('Error initializing XMTP client:', error);
      alert(`XMTP initialization failed: ${error.message}`);
    }
  };

  const generateRandomKey = async () => {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    const hexKey = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
    setGeneratedKey(hexKey);
  };

  const handleChatInitialization = () => {
    if (!xmtpClient) {
      setShowEncryptionModal(true);
    }
  };

  // Removed UserInfo component here as it's now handled within the main App component

  const switchNetwork = async (key) => {
    setNetworkEnv(key);
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setConfirmAmount('');
    setConfirmCallback(null);
  };

  const handleConfirmProceed = async () => {
    if (confirmCallback) {
      await confirmCallback();
    }
    setShowConfirmModal(false);
    setConfirmAmount('');
    setConfirmCallback(null);
  };

  return (
    <div>
      {isTestnet === '1' && (
        <Alert variant="info" className="text-center mb-4">
          <strong>Test Mode:</strong> Connected to {networkName}
          <Form onSubmit={handleMintUSDC} className="d-inline-flex align-items-center ms-3">
            <Form.Group controlId="mintAmount" className="mb-0 me-2">
              <Form.Control
                type="number"
                placeholder="Amount to Mint (USDC)"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                min="0"
                step="0.01"
                size="sm"
              />
            </Form.Group>
            <Button variant="success" type="submit" disabled={mintLoading} size="sm">
              {mintLoading ? <Spinner animation="border" size="sm" /> : 'Mint USDC'}
            </Button>
          </Form>
        </Alert>
      )}

      <Navbar bg="dark" variant="dark">
        <Container fluid> {/* Changed to fluid */}
          <Navbar.Brand href="#">
            Palket: The Pal-to-Pal Market
          </Navbar.Brand>
          <Nav className="ms-auto"> {/* Updated class to Bootstrap 5 */}
            <Nav.Link href="#">
              {account
                ? `Account: ${account.substring(0, 6)}...${account.substring(account.length - 4)}`
                : 'Not connected'}
            </Nav.Link>
            {usdcBalance !== null && (
              <Nav.Link href="#">
                {nativeBalance !== null ? `${nativeBalance} ${currencySymbol} | ` : ''} {usdcBalance} USDC
              </Nav.Link>
            )}
            <DropdownButton
              id="dropdown-basic-button"
              title="Switch Network"
              variant="outline-light"
              className="ms-2"
            >
              {networkKeys.map((key) => (
                <Dropdown.Item key={key} onClick={() => switchNetwork(key)}>
                  {PalketInfo.networks[key].name}
                </Dropdown.Item>
              ))}
            </DropdownButton>
            {/* Removed 'My Profile' button as profiles are now in-page */}
            <Button
              variant="outline-light"
              onClick={account ? changeAccount : connectWallet}
              className="ms-2"
            >
              {account ? 'Change Account' : 'Connect Wallet'}
            </Button>
          </Nav>
        </Container>
      </Navbar>

      <Container fluid className="mt-4">
        {message && (
          <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
            {message.text}
          </Alert>
        )}

        {/* **Menu Navigation** */}
        <Nav variant="tabs" activeKey={selectedMenu} onSelect={(selectedKey) => setSelectedMenu(selectedKey)} className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="Buy">Buy Products/Services with Crypto</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="Sell">Sell Products/Services with Crypto</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="Lottery">Lottery</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="Chat">Chat</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="Profile">Profile</Nav.Link>
          </Nav.Item>
        </Nav>
        {/* **Conditional Rendering Based on Selected Menu** */}
        {selectedMenu === 'Buy' && (
          // **Buy Products/Services with Crypto Section**
          <Row>
            {/* a) Buy Products/Services with Crypto */}
            <Col lg={4} md={12} className="mb-4">
              <Card>
                <Card.Header>
                  <h5>Buy Products/Services with Crypto</h5>
                </Card.Header>
                <Card.Body>
                  {/* Option to create an offer as a receiver */}
                  <h6>Create Offer </h6>
                  <Form>
                    <Form.Group controlId="productDescription">
                      <Form.Label>Product Description</Form.Label>
                      <Form.Control
                        type="text"
                        name="productDescription"
                        placeholder="Product Description"
                        value={formValues.productDescription}
                        onChange={handleInputChange}
                      />
                    </Form.Group>

                    <Button variant="primary" onClick={() => createOffer('ReceiverInitiated')} disabled={loading} className="mt-3">
                      {loading ? <Spinner animation="border" size="sm" /> : 'Create Offer'}
                    </Button>
                  </Form>

                  {/* List of offers created as Sender not yet accepted */}
                  <h6 className="mt-4">Your Active Purchase Offers</h6>
                  {allOffers.filter(offer => offer.offerType === 1 && offer.state === 0).length > 0 ? (
                    <Row className="g-4">
                      {allOffers
                        .filter(offer => offer.offerType === 1 && offer.state === 0)
                        .map((offer, index) => (
                          <Col key={index} lg={12} md={12} sm={12}>
                            <OfferCard
                              offer={offer}
                              usdcDecimals={usdcDecimals}
                              account={account}
                              loading={loading}
                              cancelOffer={cancelOffer}
                              finalizeOffer={finalizeOffer}
                              forfeitOffer={forfeitOffer}
                              averageScore={offer.averageScore}
                              requestParticipationForOffer={requestParticipationForOffer}
                              canChooseParticipantForOffer={canChooseParticipantForOffer}
                              isExpired={false}
                              onChat={onChat}
                              onSelectMenu={setSelectedMenu}
                              onSetProfileAddress={setSelectedProfileAddress}
                            />
                          </Col>
                        ))}
                    </Row>
                  ) : (
                    <p className="text-muted">No active purchase offers.</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {selectedMenu === 'Sell' && (
          // **Sell Products/Services with Crypto Section**
          <Row>
            {/* b) Sell Products/Services for Crypto */}
            <Col lg={4} md={12} className="mb-4">
              <Card>
                <Card.Header>
                  <h5>Sell Products/Services for Crypto</h5>
                </Card.Header>
                <Card.Body>
                  {/* Option to create an offer as a sender */}
                  <h6>Create Offer as Seller</h6>
                  <Form>
                    
                    <Form.Group controlId="productDescription">
                      <Form.Label>Product Description</Form.Label>
                      <Form.Control
                        type="text"
                        name="productDescription"
                        placeholder="Product Description"
                        value={formValues.productDescription}
                        onChange={handleInputChange}
                      />
                    </Form.Group>

                    <Form.Group controlId="productValue">
                      <Form.Label>Product Value (USDC)</Form.Label>
                      <Form.Control
                        type="number"
                        name="productValue"
                        placeholder="Product Value (USDC)"
                        value={formValues.productValue}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                      />
                    </Form.Group>

                    <Button variant="primary" onClick={() => createOffer('SenderInitiated')} disabled={loading} className="mt-3">
                      {loading ? <Spinner animation="border" size="sm" /> : 'Create Offer'}
                    </Button>
                  </Form>

                  {/* List of offers created as Receiver not yet accepted */}
                  <h6 className="mt-4">Your Active Sales Offers</h6>
                  {allOffers.filter(offer => offer.offerType === 0 && offer.state === 0).length > 0 ? (
                    <Row className="g-4">
                      {allOffers
                        .filter(offer => offer.offerType === 0 && offer.state === 0)
                        .map((offer, index) => (
                          <Col key={index} lg={12} md={12} sm={12}>
                            <OfferCard
                              offer={offer}
                              usdcDecimals={usdcDecimals}
                              account={account}
                              loading={loading}
                              cancelOffer={cancelOffer}
                              finalizeOffer={finalizeOffer}
                              forfeitOffer={forfeitOffer}
                              averageScore={offer.averageScore}
                              requestParticipationForOffer={requestParticipationForOffer}
                              canChooseParticipantForOffer={canChooseParticipantForOffer}
                              isExpired={false}
                              onChat={onChat}
                              onSelectMenu={setSelectedMenu}
                              onSetProfileAddress={setSelectedProfileAddress}
                            />
                          </Col>
                        ))}
                    </Row>
                  ) : (
                    <p className="text-muted">No active sales offers.</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {selectedMenu === 'Lottery' && (
          // **Lottery Section**
          <Row>
            {/* c) Lottery */}
            <Col lg={4} md={12} className="mb-4">
              <Card>
                <Card.Header>
                  <h5>Lottery</h5>
                </Card.Header>
                <Card.Body>
                  {/* List of accepted and expired offers */}
                  <h6>Expired Accepted Offers</h6>
                  {allOffers.filter(offer => offer.state === 1 && (offer.acceptanceTime + 180 * 24 * 60 * 60) <= Math.floor(Date.now() / 1000)).length > 0 ? (
                    <Row className="g-4">
                      {allOffers
                        .filter(offer => offer.state === 1 && (offer.acceptanceTime + 180 * 24 * 60 * 60) <= Math.floor(Date.now() / 1000))
                        .map((offer, index) => (
                          <Col key={index} lg={12} md={12} sm={12}>
                            <OfferCard
                              offer={offer}
                              usdcDecimals={usdcDecimals}
                              account={account}
                              loading={loading}
                              cancelOffer={cancelOffer}
                              finalizeOffer={finalizeOffer}
                              forfeitOffer={forfeitOffer}
                              averageScore={offer.averageScore}
                              requestParticipationForOffer={requestParticipationForOffer}
                              canChooseParticipantForOffer={canChooseParticipantForOffer}
                              isExpired={true}
                              onChat={onChat}
                              onSelectMenu={setSelectedMenu}
                              onSetProfileAddress={setSelectedProfileAddress}
                            />
                          </Col>
                        ))}
                    </Row>
                  ) : (
                    <p className="text-muted">No expired accepted offers available for forfeiture.</p>
                  )}

                  {/* Button to proceed with forfeiture */}
                  <Button
                    variant="warning"
                    onClick={handleForfeitExpiredOffers}
                    disabled={loading}
                    className="mt-3"
                  >
                    {loading ? <Spinner animation="border" size="sm" /> : 'Forfeit Expired Offers'}
                  </Button>
                  {/* **Updated Alert Component** */}
                  <Alert variant="warning" className="mt-3">
                    <strong>Note:</strong> If an offer is forfeited:
                    <ul>
                      <li>10% goes to the caller</li>
                      <li>10% goes to the contract creator</li>
                      <li>80% goes to a random participant</li>
                    </ul>
                  </Alert>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {selectedMenu === 'Chat' && (
          // **Chat Section**
          <Card className="mb-4">
            <Card.Header>
              <h4>Chat</h4>
            </Card.Header>
            <Card.Body style={{ padding: '0' }}>
              {!xmtpClient ? (
                // Fixed the onClick handler by mapping it to handleChatInitialization
                <Button variant="primary" onClick={handleChatInitialization}>
                  Start Chat
                </Button>
              ) : (
                <Chat xmtpClient={xmtpClient} targetAddress={currentChatAddress} />
              )}
            </Card.Body>
          </Card>
        )}

        {selectedMenu === 'Profile' && (
          // **Profile Section**
          <UserProfile
            marketplaceContract={marketplaceContract}
            usdcDecimals={usdcDecimals}
            account={account}
            userAddress={selectedProfileAddress}
            setShowDescriptionModal={setShowDescriptionModal}
            onChat={onChat}
            onSelectMenu={setSelectedMenu}
            onSetProfileAddress={setSelectedProfileAddress}
          />

        )}

      </Container>

      {/* Description Modal */}
      <Modal show={showDescriptionModal} onHide={() => setShowDescriptionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Set Your Description</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="userDescription">
            <Form.Label>Description as Sender</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter your description"
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDescriptionModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={updateUserDescription} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Save'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Request Participation Modal */}
      {currentOfferForParticipation && (
        <RequestParticipationModal
          show={showRequestModal}
          onHide={() => {
            setShowRequestModal(false);
            setCurrentOfferForParticipation(null);
          }}
          loading={loading}
          requestParticipation={handleRequestParticipation}
          offerType={currentOfferForParticipation.offerType}
        />
      )}

      {/* Choose Participant Modal */}
      {currentOfferForChoosing && (
        <ChooseParticipantModal
          show={showChooseModal}
          onHide={() => {
            setShowChooseModal(false);
            setCurrentOfferForChoosing(null);
            setParticipants([]);
          }}
          participants={participants}
          chooseParticipant={chooseParticipant}
          loading={loadingParticipants} // Pass loadingParticipants instead of global loading
        />
      )}

      {/* Confirm Transaction Modal */}
      <ConfirmTransactionModal
        show={showConfirmModal}
        onHide={handleConfirmCancel}
        amount={confirmAmount}
        onConfirm={handleConfirmProceed}
        loading={loading}
      />

      {/* Encryption Key Modal for XMTP */}
      <Modal show={showEncryptionModal} onHide={() => setShowEncryptionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Initialize Chat</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!generatedKey ? (
            <>
              <p>Do you have an existing encryption key?</p>
              <Form.Label>Enter your encryption key (hex) if you have one:</Form.Label>
              <Form.Control
                type="text"
                placeholder="Existing encryption key (hex)"
                value={encryptionKeyInput}
                onChange={(e) => setEncryptionKeyInput(e.target.value)}
              />
              <div className="mt-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!encryptionKeyInput) {
                      alert('Please enter a key or choose to create a new one.');
                      return;
                    }
                    initializeXmtp(encryptionKeyInput);
                  }}
                >
                  Use Existing Key
                </Button>{' '}
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await generateRandomKey();
                  }}
                >
                  Create New Key
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert variant="info">
                <strong>Your new encryption key:</strong>
                <br />
                {generatedKey}
              </Alert>
              <p>Please store this key in a safe place. If you lose it, you cannot recover your previous conversations.</p>
              <Button
                variant="primary"
                onClick={() => {
                  if (!generatedKey) {
                    alert('Key not generated.');
                    return;
                  }
                  initializeXmtp(generatedKey);
                }}
              >
                Proceed with this new key
              </Button>
            </>
          )}
        </Modal.Body>
      </Modal>

      
    </div>
  );
}

export default App;
