import React, { useState } from 'react';
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
    //TODO: put contract address here
    const contractAddress = "0xdea18c3e92a8b959b4b52b39be8f09367109614f"; // Replace with your actual contract address
    const provider = new ethers.providers.JsonRpcProvider('https://base-sepolia.publicnode.com');
    // Define the contract ABI (replace with the full ABI if available)
    const contractAbi = [
        "function addAuthorizedUser(address user) external",
        "function authorizedUsers(address) external view returns (bool)"
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
                const balance = parseFloat(response.data.balance).toFixed(6); // Convert balance to a formatted number with 6 decimal places
                setWalletAddress(address); // Set wallet address
                setWalletBalance(balance); // Set wallet balance with formatting
                setCurrentScreen('walletDetails'); // Move to the wallet details screen
                setStatus('Wallet created and funded successfully!');
            })
            .catch(createError => setStatus(`Wallet creation failed: ${createError.response ? createError.response.data.message : createError.message}`));
    };

    // Add a new transaction request
    const addTransactionRequest = () => {
        const recipient = prompt("Enter the recipient address:");
        const amount = prompt("Enter the amount (ETH):");
        const description = prompt("Enter a brief description for this request:");

        if (recipient && amount && description) {
            const newRequest = {
                id: Date.now(), // Use a unique ID based on the timestamp
                recipient,
                amount: parseFloat(amount).toFixed(6), // Format the amount
                description,
                status: 'pending', // Default status
            };
            setTransactionRequests([...transactionRequests, newRequest]);
        }
    };

    // Update the status of a transaction request
    const updateRequestStatus = (id, newStatus) => {
        setTransactionRequests(transactionRequests.map(req => (req.id === id ? { ...req, status: newStatus } : req)));
    };

    // Add a new authorized user
    // const addAuthorizedUser = () => {
    //     const userName = prompt("Enter the name of the authorized user:");
    //     const userAddress = prompt("Enter the Ethereum address of the authorized user (e.g., 0x123...):");
    //
    //     if (userName && userAddress) {
    //         const newUser = { id: Date.now(), name: userName, address: userAddress };
    //         setAuthorizedUsers([...authorizedUsers, newUser]);
    //     }
    // };

    // Remove an authorized user
    const removeAuthorizedUser = (id) => {
        setAuthorizedUsers(authorizedUsers.filter(user => user.id !== id));
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>University of Florida ACM Funds Manager</h1>

                {/* Wallet Creation Screen */}
                {currentScreen === 'walletCreation' && (
                    <div>
                        <h1>Web3 Modal Connection!</h1>
                        {
                            web3Provider == null ? (
                                //run if null
                                <button onClick={connectWallet}>
                                    Connect Wallet
                                </button>

                            ) : (
                                <div>
                                    <p>Connected!</p>
                                    <p>Address: {web3Provider.provider.selectedAddress}</p>
                                </div>
                            )
                        }
                        <h2>Create Sending Wallet</h2>
                        <button onClick={createAndFundWallet}>Create and Fund Club Wallet</button>
                        <p>Status: {status}</p>
                    </div>
                )}

                {/* Wallet Details Screen */}
                {currentScreen === 'walletDetails' && (
                    <div>
                        <h2>Wallet Created Successfully!</h2>
                        <p>Here are your wallet details:</p>
                        <h3>Wallet Address: {walletAddress}</h3>
                        <h3>Wallet Balance: {walletBalance} ETH</h3>
                        <button onClick={() => setCurrentScreen('authorizedUsers')}>Next</button>
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
                        <h2>Wallet Address: {walletAddress}</h2>
                        <h3>Wallet Balance: {walletBalance !== '' ? `${walletBalance} ETH` : 'Balance not available'}</h3>

                        {/* Address Input Section */}
                        <div className="input-container">
                            <h2>Receiving Addresses</h2>
                            <button onClick={addAddress}>Add Address</button>
                            <ul>
                                {addresses.map((address, index) => (
                                    <li key={index}>
                                        {address} <button onClick={() => removeAddress(index)}>Remove</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Transaction Request Section */}
                        <div className="transaction-container">
                            <h2>Transaction Requests</h2>
                            <button onClick={addTransactionRequest}>Add New Request</button>
                            <ul>
                                {transactionRequests.map((request) => (
                                    <li key={request.id}>
                                        <strong>{request.description}</strong> - {request.amount} ETH to {request.recipient}
                                        <span> (Status: {request.status}) </span>
                                        <button onClick={() => updateRequestStatus(request.id, 'accepted')}>Accept</button>
                                        <button onClick={() => updateRequestStatus(request.id, 'denied')}>Deny</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Amount Input Section */}
                        <div className="input-container">
                            <h2>Transfer Amount (ETH)</h2>
                            <input
                                type="number"
                                step="0.00000001"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="Enter amount in ETH"
                            />
                        </div>

                        {/* Send Button */}
                        <button onClick={sendPayouts}>Send Payouts</button>
                        <p>Status: {status}</p>
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;
