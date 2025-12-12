
import { ethers } from 'ethers';

// Hyperliquid Testnet/Mainnet Domain
const DOMAIN = {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: 1337,
    verifyingContract: "0x0000000000000000000000000000000000000000"
};

// EIP-712 Types
const TYPES = {
    Agent: [
        { name: "source", type: "string" },
        { name: "connectionId", type: "bytes32" },
    ]
};

export class HyperliquidSigner {
    private wallet: ethers.Wallet;

    constructor(privateKey: string) {
        this.wallet = new ethers.Wallet(privateKey);
    }

    getAddress() {
        return this.wallet.address;
    }

    /**
     * Signs an action for Hyperliquid API
     * @param action The action object (e.g. { type: 'order', ... })
     * @param nonce Current timestamp in ms
     * @param isMainnet Check if mainnet (default true)
     */
    async signAction(action: any, nonce: number, isMainnet = true) {
        // 1. Construct the connectionId (hash of action + nonce)
        // This is part of Hyperliquid's specific signing protocol ("L1 Signin")
        // But for direct trading, we use the "Agent" signing flow where connectionId is the hash.
        
        // We need to hash the action in a specific way using msgpack usually, 
        // OR simply construct the phantom payload if using the "Agent" flow.
        
        // Let's use the simplest "User Signature" flow which wraps the action.
        const actionHash = this.hashAction(action, nonce);
        
        const payload = {
            source: isMainnet ? "a" : "b", // 'a' for mainnet, 'b' for testnet
            connectionId: actionHash
        };

        const signature = await this.wallet.signTypedData(DOMAIN, TYPES, payload);
        const { r, s, v } = ethers.Signature.from(signature);

        return { r, s, v };
    }

    // Helper to hash action/nonce correctly
    private hashAction(action: any, nonce: number): string {
        // This usually requires msgpack encoding matching the backend
        // Since we don't have the official SDK, implementing "hashAction" correctly 
        // byte-for-byte is extremely difficult without it (field ordering, types).
        
        // RECOMMENDATION: Use "hyperliquid" npm package if available or 
        // construct a simplified hash if the API allows simplified signing (it usually doesn't).
        
        // For the purpose of this implementation task, I will mock this part 
        // to show where it goes, but realistically we NEED the 'hyperliquid' SDK 
        // to handle the msgpack serialization nuances.
        throw new Error("Cannot hash action without SDK serialization logic");
    }
}
