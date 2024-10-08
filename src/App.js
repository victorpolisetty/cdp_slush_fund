import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Web3Modal from "web3modal"
import {ethers} from "ethers";
import {CoinbaseWalletSDK} from "@coinbase/wallet-sdk";

const providerOptions = {
    coinbasewallet: {
        package: CoinbaseWalletSDK,
        options: {
            appName: "My First Key",
            infuraId: {1: "https://base-sepolia.infura.io/v3/3f5e8882f498469a8039d624c9fe1720"}
        }
    }

}

function App() {
    const [addresses, setAddresses] = useState([]);
    const [transferAmount, setTransferAmount] = useState('');
    const [status, setStatus] = useState('');
    const [currentScreen, setCurrentScreen] = useState('walletCreation'); // Track the current screen
    const [walletAddress, setWalletAddress] = useState('');
    const [walletBalance, setWalletBalance] = useState(''); // Store wallet balance
    const [transactionRequests, setTransactionRequests] = useState([]); // Track transaction requests
    const [authorizedUsers, setAuthorizedUsers] = useState([]); // Track authorized users
    const [web3Provider, setWeb3Provider] = useState(null);
    const [contractBalance, setContractBalance] = useState(''); // New state variable for contract balance

    //TODO: put contract address here
    const contractAddress = "0x8824aece0c78b3869c16dd4fa96d451480732417"; // TODO: Replace with your actual contract address
    const provider = new ethers.providers.JsonRpcProvider('https://base-sepolia.publicnode.com');
    // Define the contract ABI (replace with the full ABI if available)
    const contractAbi = [
        "function addAuthorizedUser(address user) external",
        "function authorizedUsers(address) external view returns (bool)",
        "function requestCounter() public view returns (uint256)",
        "function transactionRequests(uint256) public view returns (uint256 id, address requester, address to, uint256 amount, string memory description, bool approved, bool executed)",
        "function approveTransactionRequest(uint256 requestId) external",
        "function createTransactionRequest(address _to, uint256 _amount, string memory _description) external",
        "function executeTransactionRequest(uint256 requestId) external",
        "function owner() public view returns (address)",
        "function authorizedUsers(address) public view returns (bool)"
    ];

    async function connectWallet() {
        try {
            // Clear the Web3Modal cache to prevent connecting to the wrong wallet automatically
            let web3Modal = new Web3Modal({
                cacheProvider: false,  // Disabling cache to start fresh
                providerOptions,
            });

            // Check if a cached provider exists and clear it
            if (web3Modal.cachedProvider) {
                await web3Modal.clearCachedProvider();
            }

            // Connect to a new wallet
            const web3ModalInstance = await web3Modal.connect();
            const web3ModalProvider = new ethers.providers.Web3Provider(web3ModalInstance);

            // Check for multiple accounts and select the correct one
            const accounts = await web3ModalProvider.listAccounts();
            const selectedAccount = accounts[0]; // Default to the first account

            console.log("Connected accounts: ", accounts);
            console.log("Selected account: ", selectedAccount);

            if (web3ModalProvider) {
                setWeb3Provider(web3ModalProvider);
                setWalletAddress(selectedAccount); // Explicitly set the connected wallet address
                setStatus(`Wallet connected: ${selectedAccount}`);
            }
        } catch (error) {
            console.error(error);
            setStatus(`Connection failed: ${error.message}`);
        }
    }

    // Function to fetch transaction requests from the smart contract
    const fetchRequests = async () => {
        try {
            // Ensure the web3 provider is connected
            if (!web3Provider) {
                console.error("No web3 provider found. Please connect the wallet first.");
                return;
            }

            // Use the provider to create a contract instance
            const contract = new ethers.Contract(contractAddress, contractAbi, web3Provider);

            // Fetch the transaction request count
            const requestCount = await contract.requestCounter();
            let fetchedRequests = [];

            // Loop through each request in the smart contract and fetch its details
            for (let i = 0; i < requestCount; i++) {
                const request = await contract.transactionRequests(i);
                fetchedRequests.push({
                    id: request.id.toNumber(),
                    requester: request.requester,
                    to: request.to,
                    amount: ethers.utils.formatEther(request.amount),
                    description: request.description,
                    approved: request.approved,
                    executed: request.executed,
                });
            }

            // Update the state with the fetched requests
            setTransactionRequests(fetchedRequests);
        } catch (error) {
            console.error("Error fetching transaction requests:", error);
        }
    };

    // Function to approve a transaction request
    const approveRequest = async (requestId) => {
        try {
            if (!web3Provider) {
                console.error("No web3 provider found. Please connect the wallet first.");
                return;
            }

            // Get signer from the connected provider
            const signer = web3Provider.getSigner();

            // Create a contract instance with the signer to perform write operations
            const contract = new ethers.Contract(contractAddress, contractAbi, signer);

            console.log(`Attempting to approve request ID: ${requestId}`);

            // Call the smart contract function to approve the request
            const tx = await contract.approveTransactionRequest(requestId);

            console.log("Transaction sent, waiting for confirmation...");

            // Wait for the transaction to be confirmed
            await tx.wait();

            console.log("Transaction confirmed:", tx);

            setStatus(`Request ${requestId} approved successfully.`);
            fetchRequests(); // Refresh the list of requests after approval
        } catch (error) {
            console.error("Error approving request:", error);
            setStatus(`Error approving request: ${error.message}`);
        }
    };


    // Function to deny a transaction request (local state update only)
    const denyRequest = (requestId) => {
        setTransactionRequests(transactionRequests.map(req => (
            req.id === requestId ? { ...req, status: 'denied' } : req
        )));
        setStatus(`Request ${requestId} denied.`);
    };

    useEffect(() => {
        if (web3Provider) {
            fetchRequests();
            fetchContractBalance(); // Fetch contract balance when the provider is available
        }
    }, [web3Provider]);


// Function to add an authorized user to the smart contract on Base Sepolia
    const addAuthorizedUser = async () => {
        try {
            // Check if the web3 provider (MetaMask) is available
            if (!window.ethereum) {
                alert("Please install MetaMask or another web3 wallet!");
                return;
            }

            // Create a new provider instance using MetaMask's provider
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);

            // Request account access if needed
            await window.ethereum.request({ method: "eth_requestAccounts" });

            // Get the connected network details
            const network = await web3Provider.getNetwork();

            // Check if the connected network is Base Sepolia (chainId: 84531)
            if (network.chainId !== 84532) {
                alert("Please switch your MetaMask network to Base Sepolia!");
                return;
            }

            // Prompt the user for the Ethereum address of the authorized user
            const userAddress = prompt("Enter the Ethereum address of the authorized user (e.g., 0x123...):");
            if (!userAddress || !ethers.utils.isAddress(userAddress)) {
                alert("Invalid Ethereum address entered. Please try again.");
                return;
            }

            // Get the signer from the connected provider
            const signer = web3Provider.getSigner();

            // Initialize the contract instance with signer to perform write operations
            const contract = new ethers.Contract(contractAddress, contractAbi, signer);

            // Call the addAuthorizedUser function on the contract
            const tx = await contract.addAuthorizedUser(userAddress);

            // Wait for the transaction to be mined
            await tx.wait();

            // Update the state with the new user if the transaction is successful
            const newUser = { id: Date.now(), name: "Authorized User", address: userAddress };
            setAuthorizedUsers([...authorizedUsers, newUser]);
            setStatus(`User ${userAddress} added successfully to the smart contract on Base Sepolia.`);
        } catch (error) {
            console.error("Error adding user to contract:", error);
            setStatus(`Error adding user: ${error.message}`);
        }
    };

    // Function to execute a transaction request
    const executeRequest = async (requestId) => {
        try {
            if (!web3Provider) {
                console.error("No web3 provider found. Please connect the wallet first.");
                return;
            }

            // Get signer from the connected provider
            const signer = web3Provider.getSigner();

            // Create a contract instance with the signer to perform write operations
            const contract = new ethers.Contract(contractAddress, contractAbi, signer);

            console.log(`Attempting to execute request ID: ${requestId}`);

            // Call the smart contract function to execute the request
            const tx = await contract.executeTransactionRequest(requestId);

            console.log("Transaction sent, waiting for confirmation...");

            // Wait for the transaction to be confirmed
            await tx.wait();

            console.log("Transaction executed successfully:", tx);

            setStatus(`Request ${requestId} executed successfully.`);
            fetchRequests(); // Refresh the list of requests after execution
        } catch (error) {
            console.error("Error executing request:", error);
            setStatus(`Error executing request: ${error.message}`);
        }
    };


    // Handler to add a new receiving address
    const addAddress = () => {
        const newAddress = prompt("Enter a new Ethereum address (e.g., 0x123... or yuga.base.eth):");
        if (newAddress) setAddresses([...addresses, newAddress]);
    };

    // Handler to remove an address
    const removeAddress = (index) => {
        const updatedAddresses = addresses.filter((_, i) => i !== index);
        setAddresses(updatedAddresses);
    };

    // Handler to execute the mass payouts
    const sendPayouts = () => {
        if (addresses.length === 0 || !transferAmount) {
            alert("Please add at least one address and specify the transfer amount.");
            return;
        }

        setStatus('Sending payouts...');
        const data = {
            addresses,
            transferAmount: parseFloat(transferAmount),
        };

        axios.post(`${process.env.REACT_APP_BACKEND_URL}/send`, data)
            .then(response => setStatus(`Payout successful: ${response.data.message}`))
            .catch(error => setStatus(`Payout failed: ${error.response ? error.response.data.message : error.message}`));
    };

    // Consolidated handler to create and fund the wallet
    const createAndFundWallet = () => {
        setStatus('Creating and funding wallet...');

        axios.post(`${process.env.REACT_APP_BACKEND_URL}/create-and-fund-wallet`)
            .then(response => {
                const address = response.data.address;
                const balance = parseFloat(response.data.balance).toFixed(2); // Convert balance to a formatted number with 6 decimal places
                setWalletAddress(address); // Set wallet address
                setWalletBalance(balance); // Set wallet balance with formatting
                setCurrentScreen('walletDetails'); // Move to the wallet details screen
                setStatus('Wallet created and funded successfully!');
            })
            .catch(createError => setStatus(`Wallet creation failed: ${createError.response ? createError.response.data.message : createError.message}`));
    };

    // Remove an authorized user
    const removeAuthorizedUser = (id) => {
        setAuthorizedUsers(authorizedUsers.filter(user => user.id !== id));
    };

    // Function to fetch the contract balance
    const fetchContractBalance = async () => {
        try {
            // Use the existing provider to get the contract balance
            const balance = await provider.getBalance(contractAddress);
            setContractBalance(ethers.utils.formatEther(balance));
        } catch (error) {
            console.error("Error fetching contract balance:", error);
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Club Funds Manager</h1>

                {/* Wallet Creation Screen */}
                {currentScreen === 'walletCreation' && (
                    <div>
                        <p>Create and fund your wallet!</p>
                        <button onClick={createAndFundWallet}>Click me!</button>
                        <p>Status: {status}</p>
                    </div>
                )}

                {/* Wallet Details Screen */}
                {currentScreen === 'walletDetails' && (
                    <div>
                        <h3>Here are your wallet details!</h3>
                        <p>Wallet Address: {walletAddress}</p>
                        <p>Wallet Balance: {walletBalance} ETH</p>
                        <button onClick={() => setCurrentScreen('walletConnect')}>Next</button>
                    </div>
                )}

                {/* Wallet Creation Screen */}
                {currentScreen === 'walletConnect' && (
                    <div>
                        <p>Connect your wallet!</p>
                        {
                            web3Provider == null ? (
                                //run if null
                                <button onClick={connectWallet}>
                                    Connect Wallet
                                </button>
                            ) : (
                                <div>
                                    <p>Connected!</p>
                                    <h3>Address: {web3Provider.provider.selectedAddress}</h3>
                                    <button onClick={() => setCurrentScreen('authorizedUsers')}>Next</button>
                                </div>
                            )
                        }

                    </div>
                )}

                {/* Authorized Users Screen */}
                {currentScreen === 'authorizedUsers' && (
                    <div>
                        <h2>Manage Authorized Users</h2>
                        <button onClick={addAuthorizedUser}>Add Authorized User</button>
                        <ul>
                            {authorizedUsers.map((user) => (
                                <li key={user.id}>
                                    {user.name} ({user.address})
                                    <button onClick={() => removeAuthorizedUser(user.id)}>Remove</button>
                                </li>
                            ))}
                        </ul>
                        <button onClick={() => setCurrentScreen('payouts')}>Next</button>
                    </div>
                )}

                {/* Payouts Screen */}
                {currentScreen === 'payouts' && (
                    <div>
                        {/* Display the Wallet Address and Balance */}
                        <p>Wallet Address: {walletAddress}</p>
                        <p>Wallet Balance: {walletBalance !== '' ? `${walletBalance} ETH` : 'Balance not available'}</p>

                        {/* Display the Contract Address and Balance */}
                        <h3>Smart Contract Information</h3>
                        <p>Contract Address: {contractAddress}</p>
                        <p>Contract Balance: {contractBalance !== '' ? `${contractBalance} ETH` : 'Balance not available'}</p>

                        {/* Transaction Request Section */}
                        <div>
                            <h2>Transaction Requests</h2>
                            {transactionRequests.length === 0 ? (
                                <p>No transaction requests found.</p>
                            ) : (
                                <ul>
                                    {transactionRequests.map((req) => (
                                        <li key={req.id} style={{ fontSize: '20px', marginBottom: '15px' }}>

                                            {/* Container for "To", "Amount", and "Description" fields */}
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                                    <b style={{ marginRight: '5px' }}>To:</b>
                                                    <span>{req.to}</span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                                    <b style={{ marginRight: '5px' }}>Amount:</b>
                                                    <span>{req.amount} ETH</span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                                    <b style={{ marginRight: '5px' }}>Description:</b>
                                                    <span>{req.description}</span>
                                                </div>
                                            </div>

                                            {/* Display the status: Fulfilled for executed, Approved for approved but not executed, and Pending otherwise */}
                                            <p style={{ margin: '10px 0' }}>
                                                <b>Status:</b> {req.executed ? "Fulfilled" : req.approved ? "Approved" : req.status || "Pending"}
                                            </p>

                                            {/* Conditional rendering for Approve and Execute buttons */}
                                            {!req.approved && !req.executed && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <button style={{ fontSize: '10px', marginRight: '10px' }} onClick={() => approveRequest(req.id)}>Approve</button>
                                                    <button style={{ fontSize: '10px' }} onClick={() => denyRequest(req.id)}>Deny</button>
                                                </div>
                                            )}

                                            {/* New Execute button - Only visible if the request is approved but not executed */}
                                            {req.approved && !req.executed && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <button style={{ fontSize: '10px', backgroundColor: 'green', color: 'white' }} onClick={() => executeRequest(req.id)}>Execute</button>
                                                </div>
                                            )}
                                            {/*/!* Show a label indicating the request was fulfilled *!/*/}
                                            {/*{req.executed && (*/}
                                            {/*    <div style={{ marginTop: '10px', color: 'green' }}>*/}
                                            {/*        <p><b>✅</b></p>*/}
                                            {/*    </div>*/}
                                            {/*)}*/}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

            </header>
        </div>
    );
}

export default App;
