import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import { SYSVAR_INSTRUCTIONS_PUBKEY, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js'
import { Client } from './client'
import { AuctionHouse, Nft } from './types'

const { instructions } = AuctionHouseProgram

const { createSellInstruction, createPrintListingReceiptInstruction,  } = instructions

interface PostListingParams {
  auctionHouse: AuctionHouse
  amount: number
  nft: Nft
}

export class ListingsClient extends Client {
  async post({ auctionHouse: ah, amount, nft }: PostListingParams): Promise<void> {
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
    const metadata = new PublicKey(nft.address)

    const associatedTokenAccount = new PublicKey(
      nft.owner.associatedTokenAccountAddress
    )

    const [sellerTradeState, tradeStateBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        associatedTokenAccount,
        treasuryMint,
        tokenMint,
        buyerPrice,
        1
      )

    const [programAsSigner, programAsSignerBump] =
      await AuctionHouseProgram.findAuctionHouseProgramAsSignerAddress()

    const [freeTradeState, freeTradeBump] =
      await AuctionHouseProgram.findTradeStateAddress(
        publicKey,
        auctionHouse,
        associatedTokenAccount,
        treasuryMint,
        tokenMint,
        0,
        1
      )

    const txt = new Transaction()

    const sellInstructionArgs = {
      tradeStateBump,
      freeTradeStateBump: freeTradeBump,
      programAsSignerBump: programAsSignerBump,
      buyerPrice,
      tokenSize: 1,
    }

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
    }

    const sellInstruction = createSellInstruction(
      sellInstructionAccounts,
      sellInstructionArgs
    )

    const [receipt, receiptBump] =
      await AuctionHouseProgram.findListingReceiptAddress(sellerTradeState)

    const printListingReceiptInstruction = createPrintListingReceiptInstruction(
      {
        receipt,
        bookkeeper: publicKey,
        instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
      },
      {
        receiptBump,
      }
    )

    txt.add(sellInstruction).add(printListingReceiptInstruction)

    txt.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    txt.feePayer = publicKey

    const signed = await signTransaction(txt)

    const signature = await connection.sendRawTransaction(signed.serialize())

    await connection.confirmTransaction(signature, 'confirmed')
  }

  async cancel() {
    throw Error("Not implemented")
  }

  async buy() {
    throw Error("Not implemented")
  }
}