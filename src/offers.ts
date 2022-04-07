import { Client } from './client'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import { SYSVAR_INSTRUCTIONS_PUBKEY, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js"
import { AuctionHouse, Nft } from './types'

const { instructions } = AuctionHouseProgram
const { createDepositInstruction, createPrintBidReceiptInstruction, createPublicBuyInstruction } = instructions

export interface MakeOfferParams {
  amount: number
  auctionHouse: AuctionHouse
  nft: Nft
}
export class OffersClient extends Client {
  async make({ amount, auctionHouse: ah, nft }: MakeOfferParams) {
    const { publicKey, signTransaction } = this.wallet
    const connection = this.connection
    const buyerPrice = amount * LAMPORTS_PER_SOL
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(
      ah.auctionHouseFeeAccount
    )
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const tokenMint = new PublicKey(nft.mintAddress)
    const tokenAccount = new PublicKey(nft.owner.associatedTokenAccountAddress)
    const metadata = new PublicKey(nft.address)

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

    const depositInstructionAccounts = {
      wallet: publicKey,
      paymentAccount: publicKey,
      transferAuthority: publicKey,
      treasuryMint,
      escrowPaymentAccount,
      authority,
      auctionHouse,
      auctionHouseFeeAccount,
    }
    const depositInstructionArgs = {
      escrowPaymentBump,
      amount: buyerPrice,
    }

    const depositInstruction = createDepositInstruction(
      depositInstructionAccounts,
      depositInstructionArgs
    )

    const publicBuyInstruction = createPublicBuyInstruction(
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

    txt
      .add(depositInstruction)
      .add(publicBuyInstruction)
      .add(printBidReceiptInstruction)

    txt.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    txt.feePayer = publicKey

    const signed = await signTransaction(txt)

    const signature = await connection.sendRawTransaction(signed.serialize())

    await connection.confirmTransaction(signature, 'confirmed')
  }

  async cancel() {
    throw Error("Not implemented")
  }

  async accept() {
    throw Error("Not implemented")
  }
}