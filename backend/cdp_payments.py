# backend/cdp_payments.py
import os
import json
from cdp import Cdp, Wallet
from decimal import Decimal
from dotenv import load_dotenv

# Specify the amount of ETH to send to each address
transfer_amount = Decimal('0.000002')

# Constants
asset_id = "eth"
seed_file_name = "./backend/encrypted_seed.json"
wallet_file_name = "./backend/wallet.json"
receiving_addresses = ["yuga.base.eth"]


# Create a sending Wallet
def create_and_fund_sending_wallet():
    load_dotenv()  # Load environment variables from .env file

    api_key_name = os.environ.get('CDP_API_KEY_NAME')
    api_key_private_key = os.environ.get('CDP_API_KEY_PRIVATE_KEY')

    if not api_key_name or not api_key_private_key:
        raise ValueError("CDP API Key Name or CDP API Key Private Key is missing")

    private_key = api_key_private_key.replace('\\n', '\n')
    Cdp.configure(api_key_name, private_key)

    print("Does it exist")
    print(os.path.exists(seed_file_name))

    if os.path.exists(seed_file_name) and os.path.exists(wallet_file_name):
        print("Using existing wallet...")
        sending_wallet = import_existing_wallet()
    else:
        # Create a file with seed_file_name and add an empty JSON object to it
        with open(seed_file_name, 'w') as f:
            f.write('{}')
        sending_wallet = create_sending_wallet()
    print(sending_wallet.default_address)
    sending_wallet.faucet()
    print("My ETH balance is: ")
    print(sending_wallet.balance(asset_id))   # maybe_fund_wallet(sending_wallet)
    return sending_wallet

def create_sending_wallet():
    print("Creating wallet...")
    sending_wallet = Wallet.create()
    print(f"Wallet successfully created: {sending_wallet}")

    # Persist the wallet locally
    print("Persisting wallet...")
    wallet_id_string = json.dumps(sending_wallet.id)
    with open(wallet_file_name, 'w') as f:
        f.write(wallet_id_string)
    sending_wallet.save_seed(seed_file_name)
    print("Wallet successfully persisted.")

    sending_address = sending_wallet.default_address
    print(f"Default address for wallet: {sending_address}")
    return sending_wallet


def import_existing_wallet():
    print("Importing existing wallet...")
    # Get the wallet ID
    with open(wallet_file_name, 'r') as f:
        wallet_data = f.read()
    wallet_id = json.loads(wallet_data)

    # Get the wallet
    wallet = Wallet.fetch(wallet_id)

    # Load the seed on the wallet
    wallet.load_seed(seed_file_name)
    print(f"Imported existing wallet: {wallet_id}")

    # Fetch the addresses on the wallet
    wallet.addresses

    return wallet


# Attempts to fund a wallet if it does not have enough ETH
# def maybe_fund_wallet(sending_wallet):
#     eth_balance = sending_wallet.balance(asset_id)
#     print(f"Current ETH balance: {eth_balance}")
#
#     eth_required = transfer_amount * len(receiving_addresses)
#     print(f"ETH required: {eth_required}")
#
#     if eth_balance < eth_required:
#         print(
#             f"Need {eth_required} ETH; attempting to fund wallet with faucet. This may take ~1 minute..."
#         )
#         faucet_transaction = sending_wallet.faucet()
#
#         print(
#             f"Faucet transaction successfully completed: {faucet_transaction}")
#
#         new_eth_balance = sending_wallet.balance(asset_id)
#         print(f"New ETH balance: {new_eth_balance}")


# Send the payouts to the receiving addresses
def send_mass_payout(sending_wallet, receiving_addresses):
    if len(receiving_addresses) == 0:
        print("No receiving addresses specified; quitting.")
        return

    print("Beginning mass payouts...")
    for address in receiving_addresses:
        try:
            print(f"Sending to {address}...")
            transfer = sending_wallet.transfer(amount=transfer_amount, asset_id=asset_id, destination=address)
            transfer.wait()
            print(f"Transfer to {address} successful")
            print(f"Transaction link: {transfer.transaction_link}")
            print(f"Transaction hash: {transfer.transaction_hash}")
        except Exception as error:
            print(f"Error sending to {address}: {error}")


# Main function to execute the payment
def execute_payments(receiving_addresses):
    try:
        load_dotenv()  # Load environment variables from .env file

        api_key_name = os.environ.get('CDP_API_KEY_NAME')
        api_key_private_key = os.environ.get('CDP_API_KEY_PRIVATE_KEY')

        if not api_key_name or not api_key_private_key:
            raise ValueError("CDP API Key Name or CDP API Key Private Key is missing")

        private_key = api_key_private_key.replace('\\n', '\n')
        Cdp.configure(api_key_name, private_key)

        if os.path.exists(seed_file_name) and os.path.exists(wallet_file_name):
            print("Using existing wallet...")
            sending_wallet = import_existing_wallet()
        else:
            with open(seed_file_name, 'w') as f:
                f.write('{}')
            sending_wallet = create_sending_wallet()
        print(sending_wallet.default_address)
        print("DID I GET HERE")
        maybe_fund_wallet(sending_wallet, receiving_addresses)
        send_mass_payout(sending_wallet, receiving_addresses)

        print("Finished sending mass payouts!")
    except Exception as error:
        print(f"Error in sending mass payouts: {error}")
