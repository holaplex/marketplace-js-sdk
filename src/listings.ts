import { AuctionHouseProgram } from "@metaplex-foundation/mpl-auction-house";
import {
  SYSVAR_INSTRUCTIONS_PUBKEY,
  PublicKey,
  Transaction,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";
import { Wallet } from "@metaplex/js";
import { Client } from "./client";
import { AuctionHouse, Nft, Listing, Creator } from "./types";

const { instructions } = AuctionHouseProgram;

const {
  createSellInstruction,
  createPrintListingReceiptInstruction,
  createPublicBuyInstruction,
  createPrintBidReceiptInstruction,
  createExecuteSaleInstruction,
  createPrintPurchaseReceiptInstruction,
  createCancelInstruction,
  createCancelListingReceiptInstruction,
} = instructions;

export interface PostListingParams {
  amount: number;
  nft: Nft;
}

export interface CancelListingParams {
  listing: Listing;
  nft: Nft;
}

export interface BuyListingParams {
  listing: Listing;
  nft: Nft;
}

export class ListingsClient extends Client {
  private auctionHouse: AuctionHouse;

  constructor(
    connection: Connection,
    wallet: Wallet,
    auctionHouse: AuctionHouse
  ) {
    super(connection, wallet);

    this.auctionHouse = auctionHouse;
  }

  async post({ amount, nft }: PostListingParams): Promise<void> {
    const { publicKey, signTransaction } = this.wallet;
    const connection = this.connection;
    const ah = this.auctionHouse;

    const buyerPrice = amount;
    const auctionHouse = new PublicKey(ah.address);
    const authority = new PublicKey(ah.authority);
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount);
    const treasuryMint = new PublicKey(ah.treasuryMint);
    const tokenMint = new PublicKey(nft.mintAddress);
    const metadata = new PublicKey(nft.address);

    const associatedTokenAccount = new PublicKey(
      nft.owner.associatedTokenAccountAddress
    );

    const [sellerTradeState, tradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        associatedTokenAccount,
        treasuryMint,
        tokenMint,
        buyerPrice,
        1
      );

    const [programAsSigner, programAsSignerBump] =
      await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress();

    const [freeTradeState, freeTradeBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        associatedTokenAccount,
        treasuryMint,
        tokenMint,
        0,
        1
      );

    const txt = new Transaction();

    const sellInstructionArgs = {
      tradeStateBump,
      freeTradeStateBump: freeTradeBump,
      programAsSignerBump: programAsSignerBump,
      buyerPrice,
      tokenSize: 1,
    };

    const sellInstructionAccounts = {
      wallet: publicKey,
      tokenAccount: associatedTokenAccount,
      metadata: metadata,
      authority: authority,
      auctionHouse: auctionHouse,
      auctionHouseFeeAccount: auctionHouseFeeAccount,
      sellerTradeState: sellerTradeState,
      freeSellerTradeState: freeTradeState,
      programAsSigner: programAsSigner,
    };

    const sellInstruction = createSellInstruction(
      sellInstructionAccounts,
      sellInstructionArgs
    );

    const [receipt, receiptBump] =
      await AuctionHouseProgram.findListingReceiptAddress(sellerTradeState);

    const printListingReceiptInstruction = createPrintListingReceiptInstruction(
      {
        receipt,
        bookkeeper: publicKey,
        instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
      },
      {
        receiptBump,
      }
    );

    txt.add(sellInstruction).add(printListingReceiptInstruction);

    txt.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    txt.feePayer = publicKey;

    const signed = await signTransaction(txt);

    const signature = await connection.sendRawTransaction(signed.serialize());

    await connection.confirmTransaction(signature, "confirmed");
  }

  async cancel({ listing, nft }: CancelListingParams) {
    const { publicKey, signTransaction } = this.wallet;
    const connection = this.connection;
    const ah = this.auctionHouse;

    const auctionHouse = new PublicKey(ah.address);
    const authority = new PublicKey(ah.authority);
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount);
    const tokenMint = new PublicKey(nft.mintAddress);
    const treasuryMint = new PublicKey(ah.treasuryMint);
    const receipt = new PublicKey(listing.address);
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress);

    const buyerPrice = listing.price.toNumber();

    const [tradeState] = await AuctionHouseProgram.findTradeStateAddress(
      publicKey,
      auctionHouse,
      tokenAccount,
      treasuryMint,
      tokenMint,
      buyerPrice,
      1
    );

    const cancelInstructionAccounts = {
      wallet: publicKey,
      tokenAccount,
      tokenMint,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      tradeState,
    };
    const cancelInstructionArgs = {
      buyerPrice,
      tokenSize: 1,
    };

    const cancelListingReceiptAccounts = {
      receipt,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    };

    const cancelInstruction = createCancelInstruction(
      cancelInstructionAccounts,
      cancelInstructionArgs
    );
    const cancelListingReceiptInstruction =
      createCancelListingReceiptInstruction(cancelListingReceiptAccounts);

    const txt = new Transaction();

    txt.add(cancelInstruction).add(cancelListingReceiptInstruction);

    txt.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    txt.feePayer = publicKey;
    const signed = await signTransaction(txt);

    const signature = await connection.sendRawTransaction(signed.serialize());

    await connection.confirmTransaction(signature, "confirmed");
  }

  async buy({ listing, nft }: BuyListingParams) {
    const { publicKey, signTransaction } = this.wallet;
    const connection = this.connection;
    const ah = this.auctionHouse;

    const auctionHouse = new PublicKey(ah.address);
    const authority = new PublicKey(ah.authority);
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount);
    const treasuryMint = new PublicKey(ah.treasuryMint);
    const seller = new PublicKey(listing.seller);
    const tokenMint = new PublicKey(nft.mintAddress);
    const auctionHouseTreasury = new PublicKey(ah.auctionHouseTreasury);
    const listingReceipt = new PublicKey(listing.address);
    const sellerPaymentReceiptAccount = new PublicKey(listing.seller);
    const sellerTradeState = new PublicKey(listing.tradeState);
    const buyerPrice = listing.price.toNumber();
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress);
    const metadata = new PublicKey(nft.address);

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        publicKey
      );

    const [buyerTradeState, tradeStateBump] =
      await AuctionHouseProgram.findPublicBidTradeStateAddress(
        publicKey,
        auctionHouse,
        treasuryMint,
        tokenMint,
        buyerPrice,
        1
      );
    const [freeTradeState, freeTradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        seller,
        auctionHouse,
        tokenAccount,
        treasuryMint,
        tokenMint,
        0,
        1
      );
    const [programAsSigner, programAsSignerBump] =
      await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress();
    const [buyerReceiptTokenAccount] =
      await AuctionHouseProgram.findAssociatedTokenAccountAddress(
        tokenMint,
        publicKey
      );

    const [bidReceipt, bidReceiptBump] =
      await AuctionHouseProgram.findBidReceiptAddress(buyerTradeState);
    const [purchaseReceipt, purchaseReceiptBump] =
      await AuctionHouseProgram.findPurchaseReceiptAddress(
        sellerTradeState,
        buyerTradeState
      );

    const publicBuyInstructionAccounts = {
      wallet: publicKey,
      paymentAccount: publicKey,
      transferAuthority: publicKey,
      treasuryMint,
      tokenAccount,
      metadata,
      escrowPaymentAccount,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      buyerTradeState,
    };
    const publicBuyInstructionArgs = {
      tradeStateBump,
      escrowPaymentBump,
      buyerPrice,
      tokenSize: 1,
    };

    const executeSaleInstructionAccounts = {
      buyer: publicKey,
      seller,
      tokenAccount,
      tokenMint,
      metadata,
      treasuryMint,
      escrowPaymentAccount,
      sellerPaymentReceiptAccount,
      buyerReceiptTokenAccount,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      auctionHouseTreasury,
      buyerTradeState,
      sellerTradeState,
      freeTradeState,
      programAsSigner,
    };

    const executeSaleInstructionArgs = {
      escrowPaymentBump,
      freeTradeStateBump,
      programAsSignerBump,
      buyerPrice,
      tokenSize: 1,
    };

    const printBidReceiptAccounts = {
      bookkeeper: publicKey,
      receipt: bidReceipt,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    };
    const printBidReceiptArgs = {
      receiptBump: bidReceiptBump,
    };

    const printPurchaseReceiptAccounts = {
      bookkeeper: publicKey,
      purchaseReceipt,
      bidReceipt,
      listingReceipt,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    };
    const printPurchaseReceiptArgs = {
      purchaseReceiptBump,
    };

    const publicBuyInstruction = createPublicBuyInstruction(
      publicBuyInstructionAccounts,
      publicBuyInstructionArgs
    );
    const printBidReceiptInstruction = createPrintBidReceiptInstruction(
      printBidReceiptAccounts,
      printBidReceiptArgs
    );
    const executeSaleInstruction = createExecuteSaleInstruction(
      executeSaleInstructionAccounts,
      executeSaleInstructionArgs
    );
    const printPurchaseReceiptInstruction =
      createPrintPurchaseReceiptInstruction(
        printPurchaseReceiptAccounts,
        printPurchaseReceiptArgs
      );

    const txt = new Transaction();

    txt
      .add(publicBuyInstruction)
      .add(printBidReceiptInstruction)
      .add(
        new TransactionInstruction({
          programId: AuctionHouseProgram.PUBKEY,
          data: executeSaleInstruction.data,
          keys: executeSaleInstruction.keys.concat(
            nft.creators.map((creator: Creator) => ({
              pubkey: new PublicKey(creator.address),
              isSigner: false,
              isWritable: true,
            }))
          ),
        })
      )
      .add(printPurchaseReceiptInstruction);

    txt.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    txt.feePayer = publicKey;

    const signed = await signTransaction(txt);

    const signature = await connection.sendRawTransaction(signed.serialize());

    await connection.confirmTransaction(signature, "confirmed");
  }
}
