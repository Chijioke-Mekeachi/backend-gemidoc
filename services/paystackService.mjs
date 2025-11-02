// services/paystackService.mjs
import axios from 'axios';

class PaystackService {
    constructor() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY;
        this.baseURL = 'https://api.paystack.co';
        console.log('Paystack service initialized with key:', this.secretKey ? 'Present' : 'Missing');
    }

    getHeaders() {
        if (!this.secretKey) {
            throw new Error('Paystack secret key is missing');
        }
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    async verifyTransaction(reference) {
        try {
            console.log('Verifying transaction:', reference);
            const response = await axios.get(
                `${this.baseURL}/transaction/verify/${encodeURIComponent(reference)}`,
                { 
                    headers: this.getHeaders(),
                    timeout: 30000 // 30 second timeout
                }
            );

            console.log('Paystack verification success:', {
                status: response.data.status,
                transactionStatus: response.data.data?.status,
                amount: response.data.data?.amount,
                currency: response.data.data?.currency
            });
            return response.data;
        } catch (error) {
            console.error('Paystack verification error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw new Error('Failed to verify transaction: ' + (error.response?.data?.message || error.message));
        }
    }
}

export default new PaystackService();