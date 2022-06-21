import { Client } from './client'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import {
  PublicKey,
  Transaction,
  Connection,
  Keypair,
} from '@solana/web3.js'
import { AuctionHouse } from './types'
import { TOKEN_PROGRAM_ID, NATIVE_MINT, Token, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Wallet } from '@metaplex/js'
import { PendingTransaction } from './transaction'

const { instructions } = AuctionHouseProgram
const {
  createDepositInstruction,
  createWithdrawInstruction
} = instructions

export interface DepositParams {
  amount: number
}

export interface WithdrawParams {
  amount: number
}

export class EscrowClient extends Client {
  private auctionHouse: AuctionHouse

  constructor(
    connection: Connection,
    wallet: Wallet,
    auctionHouse: AuctionHouse
  ) {
    super(connection, wallet)

    this.auctionHouse = auctionHouse
  }

  async desposit({ amount }: DepositParams): Promise<PendingTransaction> {
    const { publicKey } = this.wallet
    const ah = this.auctionHouse
    const buyerPrice = amount
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const isSplMint = !treasuryMint.equals(NATIVE_MINT)

    let signatures: Keypair[] = []
    let splTokenTransferAuthority = Keypair.generate()
    let transferAuthority = publicKey
    let paymentAccount = publicKey

    if (isSplMint) {
      signatures = [...signatures, splTokenTransferAuthority]
      transferAuthority = splTokenTransferAuthority.publicKey
      const buyerAssociatedTokenAccount = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        treasuryMint,
        publicKey,
      )
      paymentAccount = buyerAssociatedTokenAccount
    }

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        publicKey
      )

    const txt = new Transaction()

    const depositInstructionAccounts = {
      wallet: publicKey,
      paymentAccount: paymentAccount,
      transferAuthority: transferAuthority,
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

    if (isSplMint) {
      const createApproveInstruction = Token.createApproveInstruction(
        TOKEN_PROGRAM_ID,
        paymentAccount,
        transferAuthority,
        publicKey,
        [],
        amount,
      )

      txt.add(createApproveInstruction)

      depositInstruction.keys.map((key) => {
        if (key.pubkey.equals(transferAuthority)) {
          key.isSigner = true
        }

        return key
      })
    }

    txt.add(depositInstruction)

    if (isSplMint) {
      const createRevokeInstruction = Token.createRevokeInstruction(
        TOKEN_PROGRAM_ID,
        paymentAccount,
        publicKey,
        []
      )

      txt.add(createRevokeInstruction)
    }

    return [txt, signatures]
  }

  async withdraw({ amount }): Promise<PendingTransaction> {
    const ah = this.auctionHouse
    const { publicKey, signTransaction } = this.wallet
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const auctionHouseFeeAccount = new PublicKey(ah.auctionHouseFeeAccount)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const isSplMint = !treasuryMint.equals(NATIVE_MINT)

    const userAssociatedTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      treasuryMint,
      publicKey,
    )

    let receiptAccount = publicKey

    if (isSplMint) {
      receiptAccount = userAssociatedTokenAccount
    }

    const [escrowPaymentAccount, escrowPaymentBump] =
      await AuctionHouseProgram.findEscrowPaymentAccountAddress(
        auctionHouse,
        publicKey
      )

    const tx = new Transaction()

    const withdrawInstructionAccounts = {
      receiptAccount: receiptAccount,
      wallet: publicKey,
      escrowPaymentAccount,
      auctionHouse,
      authority,
      treasuryMint,
      auctionHouseFeeAccount,
    }

    const withdrawInstructionArgs = {
      escrowPaymentBump,
      amount,
    }

    const withdrawInstruction = createWithdrawInstruction(
      withdrawInstructionAccounts,
      withdrawInstructionArgs
    )

    tx.add(withdrawInstruction)

    return [tx, []]
  }
}
