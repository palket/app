// src/Wiki.jsx

import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Nav, Modal, Button } from 'react-bootstrap';
import mermaid from 'mermaid';
import './Wiki.css'; // Import the CSS file

import potentialScenarios from './assets/potential_scenarios.png';

// Initialize Mermaid once at the top level.
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontSize: 40
});

// Reusable MermaidChart component
function MermaidChart({ chart }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = chart;
        mermaid.init(undefined, containerRef.current);
      } catch (error) {
        console.error('Mermaid diagram error:', error);
        containerRef.current.innerHTML = '<pre>Error rendering diagram. Please check the syntax.</pre>';
      }
    }
  }, [chart]);

  return <div ref={containerRef} className="mermaid" />;
}

function ChartModal({ show, handleClose, chart, title = 'Zoomed Diagram' }) {
  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        <div style={{ overflowX: 'auto' }}>
          <MermaidChart chart={chart} />
        </div>
      </Modal.Body>
    </Modal>
  );
}

// ImageModal component for zooming in on images
function ImageModal({ show, handleClose, src, alt }) {
  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{alt}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        <img src={src} alt={alt} className="img-fluid" />
      </Modal.Body>
    </Modal>
  );
}

function Wiki({ setSelectedMenu }) {
  // State for Image Modal
  const [chartModalShow, setChartModalShow] = useState({ show: false, chart: '' });
  const [modalShow, setModalShow] = useState(false);

  const receiverInitiatedDiagramDefinition = `
    sequenceDiagram
      participant Alice as Receiver (Alice, 4.1/5.0)
      participant SC as Palket Contract
      participant Bob as Sender (Bob, 4.4/5.0)
      participant Charlie as Potential Sender (Charlie, 3.3/5.0)

      Alice->>SC: createOfferByReceiver("Need this laptop https://amazon.com/laptop")
      activate SC
      SC->>SC: Offer's state updated to "Created"
      deactivate SC

      Bob->>SC: requestParticipation(AliceOffer, 1000)
      activate SC
      SC->>Bob: Request transfer of 500 USDC
      activate Bob
      Bob->>SC: Transfer 500 USDC
      deactivate Bob
      deactivate SC

      Charlie->>SC: requestParticipation(AliceOffer, 990)
      activate SC
      SC->>Charlie: Request transfer of 495 USDC
      activate Charlie
      Charlie->>SC: Transfer 495 USDC
      deactivate Charlie
      deactivate SC

      Alice->>SC: chooseParticipant(AliceOffer, BobAddress)
      activate SC
      SC->>Alice: Request transfer of 1500 USDC
      activate Alice
      Alice->>SC: Transfer 1500 USDC
      deactivate Alice
      SC->>SC: SetAvailableRefunds(CharlieAddress,495)      
      SC->>SC: Offer's state updated to "Accepted"
      deactivate SC

      Charlie->>SC: requestRefund()
      activate SC
      SC->>Charlie: Transfer 495 USDC      
      deactivate SC

      Bob->>Alice: Computer

      Alice->>SC: finalizeOffer(AliceOffer, 5stars)
      activate SC
      SC->>SC: SetAvailableRefunds(AliceAddress,490)      
      SC->>SC: SetAvailableRefunds(BobAddress,1500)
      SC->>SC: Offer's state updated to "Finalized"
      deactivate SC

      Alice->>SC: requestRefund()
      activate SC
      SC->>Alice: Transfer 490 USDC      
      deactivate SC

      Bob->>SC: requestRefund()
      activate SC
      SC->>Bob: Transfer 1500 USDC      
      deactivate SC
  `;

  const senderInitiatedDiagramDefinition = `
    sequenceDiagram
      participant Alice as Receiver (Alice, 4.1/5.0)
      participant Charlie as Potential Receiver (Charlie, 3.3/5.0)
      participant SC as Palket Contract
      participant Bob as Sender (Bob, 4.4/5.0)

      Bob->>SC: createOfferBySender("Selling this laptop for 1000 USDC https://amazon.com/laptop")
      activate SC
      SC->>SC: Offer's state updated to "Created"
      deactivate SC

      Alice->>SC: requestParticipation(BobOffer)
      activate SC
      SC->>Alice: Request transfer of 1500 USDC
      activate Alice
      Alice->>SC: Transfer 1500 USDC
      deactivate Alice
      deactivate SC

      Charlie->>SC: requestParticipation(BobOffer)
      activate SC
      SC->>Charlie: Request transfer of 1500 USDC
      activate Charlie
      Charlie->>SC: Transfer 1500 USDC
      deactivate Charlie
      deactivate SC

      Bob->>SC: chooseParticipant(BobOffer, AliceAddress)
      activate SC
      SC->>SC: SetAvailableRefunds(CharlieAddress,1500)      
      SC->>SC: Offer's state updated to "Accepted"
      deactivate SC

      Charlie->>SC: requestRefund()
      activate SC
      SC->>Charlie: Transfer 1500 USDC      
      deactivate SC

      Bob->>Alice: Computer

      Alice->>SC: finalizeOffer(BobOffer, 5stars)
      activate SC
      SC->>SC: SetAvailableRefunds(AliceAddress,490)      
      SC->>SC: SetAvailableRefunds(BobAddress,1500)
      SC->>SC: Offer's state updated to "Finalized"
      deactivate SC

      Alice->>SC: requestRefund()
      activate SC
      SC->>Alice: Transfer 490 USDC      
      deactivate SC

      Bob->>SC: requestRefund()
      activate SC
      SC->>Bob: Transfer 1500 USDC      
      deactivate SC
  `;

  return (
    <Container fluid className="mt-4">
      <Row>
        {/* Side Panel Navigation */}
        <Col md={3}>
          <div className="border-rounded p-3 bg-light-custom">
            <h5>Navigate</h5>
            <Nav className="flex-column">
              <Nav.Link href="#introduction">Introduction</Nav.Link>
              <Nav.Link href="#who-is-who">Who Is Receiver & Sender?</Nav.Link>
              <Nav.Link href="#how-it-works">How It Works &amp; Typical Exchange</Nav.Link>
              <Nav.Link href="#security-arbitration">Security &amp; Arbitration</Nav.Link>
              <Nav.Link href="#next-steps">Next Steps</Nav.Link>
            </Nav>
          </div>
        </Col>

        {/* Main Content Area */}
        <Col md={9}>
          <div className="border-rounded p-3 bg-white-custom">
            {/* Introduction for Newcomers */}
            <section id="introduction">
              <h2>Welcome to Palket</h2>
              <p>
                <strong>Palket</strong> is a decentralized market that connects pals
                (anonymous users, no KYC required) and allows them to exchange cryptocurrencies 
                for goods or services.
              </p>
              <p>
                Palket is based on a smart contract that acts as an escrow and enables 
                on-chain transactions in a secure, trust-minimized way. By leveraging 
                <em> deposits</em> and a <em>rating system</em>, Palket encourages 
                every Pal to act honestly.
              </p>
            </section>

            {/* Who Is Who */}
            <section id="who-is-who">
              <h4>What type of Pal are you?</h4>

              <div className="mb-4">
                <h5 className="text-receiver">Receiver</h5>
                <p>
                  The <strong className="text-receiver">Receiver</strong> is the Pal who wants to exchange 
                  cryptocurrency for a product or service in the real world.
                </p>
                <p>
                  If you own cryptocurrencies but do not want to comply with intrusive KYCs 
                  or pay high fees to convert your coins to fiat, you are clearly a <strong className="text-receiver">Receiver</strong>.
                </p>
                <p>
                  As a <strong className="text-receiver">Receiver</strong>, you can head to the{' '}
                  <Button variant="link" onClick={() => setSelectedMenu('Buy')} className="p-0">
                    <strong>Buy</strong>
                  </Button>{' '}
                  section to:
                </p>
                <ul>
                  <li>
                    Create a request for a product or service you want. If the item is listed 
                    on Amazon, Aliexpress, or any other website, include a link. Once created,
                    <strong className="text-sender"> Senders</strong> can place bids to fulfill your request. You can choose 
                    the bid that best suits your price and the <strong className="text-sender">Sender's</strong> rating.
                  </li>
                  <li>
                    Browse through <strong className="text-sender">Sender</strong> offers and accept any you wish. The 
                    price is predefined by the <strong className="text-sender">Sender</strong>.
                  </li>
                </ul>
              </div>

              <div className="mb-4">
                <h5 className="text-sender">Sender</h5>
                <p>
                  The <strong className="text-sender">Sender</strong> is the Pal who wants to exchange a product 
                  or service for cryptocurrency.
                </p>
                <p>
                  If you are a dropshipper looking to extend your business to the blockchain 
                  environment, or if you want to sell your own product/service for cryptocurrency, 
                  you are most likely a <strong className="text-sender">Sender</strong>.
                </p>
                <p>
                  As a <strong className="text-sender">Sender</strong>, you can head to the{' '}
                  <Button variant="link" onClick={() => setSelectedMenu('Sell')} className="p-0">
                    <strong>Sell</strong>
                  </Button>{' '}
                  section to:
                </p>
                <ul>
                  <li>
                    Create an offer for any product or service you want to sell. If it’s listed 
                    on Amazon, Aliexpress, or another site, feel free to link to the product page. 
                    You will predefine the price.
                  </li>
                  <li>
                    Browse through <strong className="text-receiver">Receiver</strong> requests and place bids on any 
                    that you can fulfill (or dropship).
                  </li>
                </ul>
              </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works">
              <h4>How It Works</h4>
              <Row className="mb-3">
                <Col md={6}><h5><strong className="text-receiver">Receiver</strong>-Initiated Offers</h5></Col>
                <Col md={6}><h5><strong className="text-sender">Sender</strong>-Initiated Offers</h5></Col>
              </Row>

              <Row className="process-step mb-3">
                <Col md={6}>
                  <strong>1. Offer Creation</strong>
                  <p>
                    The <strong className="text-receiver">Receiver</strong> can create an offer by providing a product description without locking funds since the price will be determined from the <strong className="text-sender">Sender</strong>'s proposals. The offer state is set to <em>Created</em>.
                  </p>
                </Col>
                <Col md={6}>
                  <strong>1. Offer Creation</strong>
                  <p>
                    The <strong className="text-sender">Sender</strong> can create an offer by providing a product description and the product price. The <strong className="text-sender">Sender</strong> will then lock a deposit of 50% of the offer’s price. The offer state is set to <em>Created</em>.
                  </p>
                </Col>
              </Row>

              <Row className="process-step mb-3">
                <Col md={6}>
                  <strong>2. Canceling</strong>
                  <p>
                    The offer can be canceled at any time while still in the <em>Created</em> state. Any locked funds will available to be returned by the Pal that provided them from <Button variant="link" onClick={() => setSelectedMenu('Profile')} className="p-0"> <strong>Profile</strong> </Button>{' '} section.
                  </p>
                </Col>
                <Col md={6}>
                  <strong>2. Canceling</strong>
                  <p>
                    The offer can be canceled at any time while still in the <em>Created</em> state. Any locked funds will available to be returned by the Pal that provided them from <Button variant="link" onClick={() => setSelectedMenu('Profile')} className="p-0"> <strong>Profile</strong> </Button>{' '} section.
                  </p>
                </Col>
              </Row>

              <Row className="process-step mb-3">
                <Col md={6}>
                  <strong>3. Participation Request</strong>
                  <p>
                    Any <strong className="text-sender">Sender</strong> can place a bid with a price, locking a deposit of 50% of the bid price.
                  </p>
                </Col>
                <Col md={6}>
                  <strong>3. Participation Request</strong>
                  <p>
                    Any <strong className="text-receiver">Receiver</strong> can send a request to accept the offer, locking 150% of the price (100% cost, 49% deposit, and 1% fee). 
                  </p>
                </Col>
              </Row>

              <Row className="process-step mb-3">
                <Col md={6}>
                  <strong>4. Choosing a Participant</strong>
                  <p>
                    The <strong className="text-receiver">Receiver</strong> reviews incoming bids and selects the preferred bid, locking 150% of the bid price (100% cost + 49% deposit + 1% fee) and triggering the refund of the rest of the bidders. The offer is then marked as <em>Accepted</em>.
                  </p>
                </Col>
                <Col md={6}>
                  <strong>4. Choosing a Participant</strong>
                  <p>
                  The <strong className="text-sender">Sender</strong> reviews incoming bids and selects the preferred bid, locking 50% of the bid price as deposit and triggering the refund of the rest of the bidders. The offer is then marked as <em>Accepted</em>.
                  </p>
                </Col>
              </Row>

              <Row className="process-step mb-3">
                <Col md={6}>
                  <strong>5. Finalization</strong>
                  <p>
                    The <strong className="text-receiver">Receiver</strong> finalizes the offer. This action unlocks funds: the <strong className="text-receiver">Receiver</strong> recovers 49% of their locked amount while the <strong className="text-sender">Sender</strong> receives the product cost plus their 50% deposit.
                  </p>
                </Col>
                <Col md={6}>
                  <strong>5. Finalization</strong>
                  <p>
                    The <strong className="text-receiver">Receiver</strong> finalizes the offer. This action unlocks funds: the <strong className="text-receiver">Receiver</strong> recovers 49% of their locked amount while the <strong className="text-sender">Sender</strong> receives the product cost plus their 50% deposit.
                  </p>
                </Col>
              </Row>

              <Row className="process-step mb-3">
                <Col md={6}>
                  <strong>6. Lottery (Forfeiture)</strong>
                  <p>
                    If an offer remains in the <em>Accepted</em> state for over 180 days, anyone can trigger a forfeiture. In this case, 10% of the locked funds goes to the trigger, 10% to the contract creator, and 80% to a randomly selected participant.
                  </p>
                </Col>
                <Col md={6}>
                  <strong>6. Lottery (Forfeiture)</strong>
                  <p>
                    If an offer remains in the <em>Accepted</em> state for over 180 days, anyone can trigger a forfeiture. In this case, 10% of the locked funds goes to the trigger, 10% to the contract creator, and 80% to a randomly selected participant.
                  </p>
                </Col>
              </Row>

              <Row className="process-step mb-3">
                <Col md={6}>
                  <strong>7. Example</strong>
                  <div 
                    className="zoomable-diagram" 
                    onClick={() => setChartModalShow({ show: true, chart: receiverInitiatedDiagramDefinition })}
                    style={{ cursor: 'pointer' }}
                  >
                    <MermaidChart chart={receiverInitiatedDiagramDefinition} />
                  </div>
                </Col>
                <Col md={6}>
                  <strong>7. Example</strong>
                  <div 
                    className="zoomable-diagram"
                    onClick={() => setChartModalShow({ show: true, chart: senderInitiatedDiagramDefinition })}
                    style={{ cursor: 'pointer' }}
                  >
                    <MermaidChart chart={senderInitiatedDiagramDefinition} />
                  </div>
                </Col>
              </Row>

              
            </section>

            {/* Security & Arbitration */}
            <section id="security-arbitration">
              <h4>Security &amp; Arbitration</h4>
              <div className="mb-4">
                <h5>Deposits</h5>
                <p>
                  Deposits ensure both parties have “skin in the game,” reducing dishonest 
                  or careless behavior:
                </p>
                <ul>
                  <li>
                    <strong>Receiver’s deposit:</strong> Motivates the <strong className="text-receiver">Receiver</strong> to finalize honestly. 
                    Otherwise, they could avoid finalizing even if they received the product/service.
                  </li>
                  <li>
                    <strong>Sender’s deposit:</strong> Ensures the <strong className="text-sender">Sender</strong> will not walk away 
                    without delivering the product/service.
                  </li>
                </ul>
              </div>

              <div className="mb-4">
                <h5>No Dispute Mechanism</h5>
                <p>
                  Palket doesn’t include on-chain arbitration. Since real-world deliveries 
                  are hard to verify on-chain, the system relies on deposits, fees, and user 
                  ratings to incentivize fair dealings.
                </p>
              </div>
            </section>

            {/* Potential Scenarios */}
            <div className="mb-4">
              <h4>Potential Scenarios</h4>
              <p>
                This diagram shows all the possible scenarios that may occur during interactions 
                with the smart contract. It illustrates how fees align Pal interests so that 
                both parties are incentivized to avoid losing money. The green arrows represent 
                the expected, successful path where both Pals emerge without a loss.
              </p>
              <div className="image-container">
                <img
                  src={potentialScenarios}
                  alt="Decision Tree"
                  className="img-fluid scenario-image"
                  onClick={() => setModalShow(true)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <ImageModal
                show={modalShow}
                handleClose={() => setModalShow(false)}
                src={potentialScenarios}
                alt="Potential Scenarios"
              />
            </div>

            {/* Next Steps */}
            <section id="next-steps">
              <h4>Next Steps</h4>
              <p>
                Here are a few suggestions to enhance your experience on Palket:
              </p>
              <ul>
                <li>
                  <strong>Create a Test Offer:</strong> Try walking through the process with 
                  a small deposit to understand the mechanics before committing to larger transactions.
                </li>
                <li>
                  <strong>Explore Ratings &amp; Reviews:</strong> Check how user ratings reflect 
                  reliability. A user with a good track record is generally more trustworthy.
                </li>
                <li>
                  <strong>Review the Smart Contract Code:</strong> If you're tech-savvy, 
                  examine the Solidity code to confirm how fees, deposits, and forfeiting are handled.
                </li>
              </ul>
            </section>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default Wiki;
