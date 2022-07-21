import { Client } from './client'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import {
  SYSVAR_INSTRUCTIONS_PUBKEY,
  PublicKey,
  Transaction,
  Connection,
  TransactionInstruction,
  Keypair,
  AccountMeta,
} from '@solana/web3.js'
import { AuctionHouse, Nft, Offer } from './types'
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  Token,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Wallet } from '@metaplex/js'
import { PendingTransaction } from './transaction'
import { createExecuteSaleInstruction } from './instructions/createExecuteSale'

const { instructions } = AuctionHouseProgram
const {
  createPrintBidReceiptInstruction,
  createPublicBuyInstruction,
  createCancelBidReceiptInstruction,
  createCancelInstruction,
  createSellInstruction,
  createPrintListingReceiptInstruction,
  createPrintPurchaseReceiptInstruction,
} = instructions

export interface MakeOfferParams {
  amount: number
  nft: Nft
}

export interface CancelOfferParams {
  offer: Offer
  nft: Nft
}

export interface AcceptOfferParams {
  offer: Offer
  nft: Nft
}

export class OffersClient extends Client {
  private auctionHouse: AuctionHouse

  constructor(
    connection: Connection,
    wallet: Wallet,
    auctionHouse: AuctionHouse
  ) {
    super(connection, wallet)

    this.auctionHouse = auctionHouse
  }

  async make({ amount, nft }: MakeOfferParams): Promise<PendingTransaction> {
    const { publicKey } = this.wallet
    const ah = this.auctionHouse
    const buyerPrice = amount
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const tokenMint = new PublicKey(nft.mintAddress)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)
    const metadata = new PublicKey(nft.address)
    const isSplMint = !treasuryMint.equals(NATIVE_MINT)

    let splTokenTransferAuthority = Keypair.generate()
    let transferAuthority = publicKey
    let paymentAccount = publicKey
    let signers: Keypair[] = []

    if (isSplMint) {
      transferAuthority = splTokenTransferAuthority.publicKey
      signers = [...signers, splTokenTransferAuthority]

      const buyerAssociatedTokenAccount = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryMint,
        publicKey
      )
      paymentAccount = buyerAssociatedTokenAccount
    }

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        publicKey
      )

    const [buyerTradeState, tradeStateBump] =
      await AuctionHouseProgram.findPublicBidTradeStateAddress(
        publicKey,
        auctionHouse,
        treasuryMint,
        tokenMint,
        buyerPrice,
        1
      )

    const txt = new Transaction()

    let publicBuyInstruction = createPublicBuyInstruction(
      {
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
      },
      {
        escrowPaymentBump,
        tradeStateBump,
        tokenSize: 1,
        buyerPrice,
      }
    )

    if (isSplMint) {
      publicBuyInstruction.keys.map((key) => {
        if (key.pubkey.equals(transferAuthority)) {
          key.isSigner = true
        }

        return key
      })
    }

    const [receipt, receiptBump] =
      await AuctionHouseProgram.findBidReceiptAddress(buyerTradeState)

    const printBidReceiptInstruction = createPrintBidReceiptInstruction(
      {
        receipt,
        bookkeeper: publicKey,
        instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
      },
      {
        receiptBump,
      }
    )

    if (isSplMint) {
      const createApproveInstruction = Token.createApproveInstruction(
        TOKEN_PROGRAM_ID,
        paymentAccount,
        transferAuthority,
        publicKey,
        [],
        amount
      )

      txt.add(createApproveInstruction)
    }

    txt.add(publicBuyInstruction).add(printBidReceiptInstruction)

    if (isSplMint) {
      const createRevokeInstruction = Token.createRevokeInstruction(
        TOKEN_PROGRAM_ID,
        paymentAccount,
        publicKey,
        []
      )

      txt.add(createRevokeInstruction)
    }

    return [txt, signers]
  }

  async cancel({ nft, offer }: CancelOfferParams): Promise<PendingTransaction> {
    const ah = this.auctionHouse
    const { publicKey } = this.wallet
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const tokenMint = new PublicKey(nft.mintAddress)
    const buyerPrice = offer.price.toNumber()
    const tradeState = new PublicKey(offer.tradeState)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)

    const [bidReceipt, _bidReceiptBump] =
      await AuctionHouseProgram.findBidReceiptAddress(tradeState)

    const txt = new Transaction()

    const cancelInstructionAccounts = {
      wallet: publicKey,
      tokenAccount,
      tokenMint,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
      tradeState,
    }

    const cancelInstructionArgs = {
      buyerPrice,
      tokenSize: 1,
    }

    const cancelBidReceiptInstructionAccounts = {
      receipt: bidReceipt,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }

    const cancelBidInstruction = createCancelInstruction(
      cancelInstructionAccounts,
      cancelInstructionArgs
    )

    const cancelBidReceiptInstruction = createCancelBidReceiptInstruction(
      cancelBidReceiptInstructionAccounts
    )

    txt.add(cancelBidInstruction).add(cancelBidReceiptInstruction)

    return [txt, []]
  }

  async accept({
    offer,
    nft,
  }: AcceptOfferParams): Promise<PendingTransaction> {
    const { publicKey } = this.wallet
    const ah = this.auctionHouse
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const tokenMint = new PublicKey(nft.mintAddress)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const auctionHouseTreasury = new PublicKey(ah.auctionHouseTreasury)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)
    const buyerPubkey = new PublicKey(offer.buyer)
    const metadata = new PublicKey(nft.address)

    const isNative = treasuryMint.equals(NATIVE_MINT)

    let sellerPaymentReceiptAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryMint,
      publicKey
    )

    if (isNative) {
      sellerPaymentReceiptAccount = publicKey
    }

    const [bidReceipt, _bidReceiptBump] =
      await AuctionHouseProgram.findBidReceiptAddress(
        new PublicKey(offer.tradeState)
      )

    const [sellerTradeState, sellerTradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        tokenAccount,
        treasuryMint,
        tokenMint,
        offer.price.toNumber(),
        1
      )

    const [buyerTradeState] =
      await AuctionHouseProgram.findPublicBidTradeStateAddress(
        buyerPubkey,
        auctionHouse,
        treasuryMint,
        tokenMint,
        offer.price.toNumber(),
        1
      )

    const [purchaseReceipt, purchaseReceiptBump] =
      await AuctionHouseProgram.findPurchaseReceiptAddress(
        sellerTradeState,
        buyerTradeState
      )

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        buyerPubkey
      )

    const [programAsSigner, programAsSignerBump] =
      await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress()

    const [freeTradeState, freeTradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        tokenAccount,
        treasuryMint,
        tokenMint,
        0,
        1
      )

    const [buyerReceiptTokenAccount] =
      await AuctionHouseProgram.findAssociatedTokenAccountAddress(
        tokenMint,
        buyerPubkey
      )

    const [listingReceipt, listingReceiptBump] =
      await AuctionHouseProgram.findListingReceiptAddress(sellerTradeState)

    const sellInstructionAccounts = {
      wallet: publicKey,
      tokenAccount,
      metadata,
      authority,
      auctionHouse: auctionHouse,
      auctionHouseFeeAccount: auctionHouseFeeAccount,
      sellerTradeState: sellerTradeState,
      freeSellerTradeState: freeTradeState,
      programAsSigner: programAsSigner,
    }

    const sellInstructionArgs = {
      tradeStateBump: sellerTradeStateBump,
      freeTradeStateBump: freeTradeStateBump,
      programAsSignerBump: programAsSignerBump,
      buyerPrice: offer.price,
      tokenSize: 1,
    }

    const printListingReceiptInstructionAccounts = {
      receipt: listingReceipt,
      bookkeeper: publicKey,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }

    const printListingReceiptInstructionArgs = {
      receiptBump: listingReceiptBump,
    }

    const executeSaleInstructionAccounts = {
      buyer: buyerPubkey,
      seller: publicKey,
      auctionHouse,
      tokenAccount,
      tokenMint,
      treasuryMint,
      metadata,
      authority,
      sellerTradeState,
      buyerTradeState,
      freeTradeState,
      sellerPaymentReceiptAccount,
      escrowPaymentAccount,
      buyerReceiptTokenAccount,
      auctionHouseFeeAccount,
      auctionHouseTreasury,
      programAsSigner,
    }
    const executeSaleInstructionArgs = {
      escrowPaymentBump,
      freeTradeStateBump,
      programAsSignerBump,
      buyerPrice: offer.price,
      tokenSize: 1,
    }
    const executePrintPurchaseReceiptInstructionAccounts = {
      purchaseReceipt,
      listingReceipt,
      bidReceipt,
      bookkeeper: publicKey,
      instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
    }

    const executePrintPurchaseReceiptInstructionArgs = {
      purchaseReceiptBump: purchaseReceiptBump,
    }

    const createListingInstruction = createSellInstruction(
      sellInstructionAccounts,
      sellInstructionArgs
    )
    const createPrintListingInstruction = createPrintListingReceiptInstruction(
      printListingReceiptInstructionAccounts,
      printListingReceiptInstructionArgs
    )
    const executeSaleInstruction = createExecuteSaleInstruction(
      executeSaleInstructionAccounts,
      executeSaleInstructionArgs
    )
    const executePrintPurchaseReceiptInstruction =
      createPrintPurchaseReceiptInstruction(
        executePrintPurchaseReceiptInstructionAccounts,
        executePrintPurchaseReceiptInstructionArgs
      )

    const txt = new Transaction()

    let remainingAccounts: AccountMeta[] = []

    for (let creator of nft.creators) {
      const creatorAccount = {
        pubkey: new PublicKey(creator.address),
        isSigner: false,
        isWritable: true,
      }
      remainingAccounts = [...remainingAccounts, creatorAccount]

      if (isNative) {
        continue
      }

      const pubkey = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryMint,
        creatorAccount.pubkey
      )

      const creatorAtaAccount = {
        pubkey,
        isSigner: false,
        isWritable: true,
      }

      remainingAccounts = [...remainingAccounts, creatorAtaAccount]
    }

    txt
      .add(createListingInstruction)
      .add(createPrintListingInstruction)
      .add(
        new TransactionInstruction({
          programId: AuctionHouseProgram.PUBKEY,
          data: executeSaleInstruction.data,
          keys: executeSaleInstruction.keys.concat(remainingAccounts),
        })
      )
      .add(executePrintPurchaseReceiptInstruction)

    return [txt, []]
  }
}
