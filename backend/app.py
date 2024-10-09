# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from cdp_payments import execute_payments, create_and_fund_sending_wallet, import_existing_wallet

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


@app.route('/create-and-fund-wallet', methods=['POST'])
def create_and_fund_wallet():
    try:
        wallet = create_and_fund_sending_wallet()
        return jsonify({'address': wallet.default_address.address_id, 'balance': wallet.balance("eth")}), 200
    except Exception as e:
        return jsonify({'message': str(e)}), 500


# @app.route('/fund-wallet', methods=['POST'])
# def fund_wallet():
#     try:
#         wallet = import_existing_wallet()
#         maybe_fund_wallet(wallet)
#         eth_balance = wallet.balance('eth')
#         return jsonify({'balance': str(eth_balance)}), 200
#     except Exception as e:
#         return jsonify({'message': str(e)}), 500


#TODO: Fix this
@app.route('/send', methods=['POST'])
def send_payouts():
    try:
        # Get addresses from the request payload
        data = request.get_json()
        print("The data from the json request is")
        print(data)
        addresses = data.get('addresses', [])
        print("The addresses from the json request is")
        print(addresses)
        if not addresses:
            return jsonify({'message': 'No receiving addresses provided'}), 400

        # Pass the receiving addresses to the execute_payments function
        execute_payments(receiving_addresses=addresses)
        return jsonify({'message': 'Payouts successful'}), 200
    except Exception as e:
        return jsonify({'message': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
