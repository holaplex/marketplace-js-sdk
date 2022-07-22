import { Client } from './client'
import { AuctionHouseProgram } from '@metaplex-foundation/mpl-auction-house'
import { PublicKey, Connection, Keypair } from '@solana/web3.js'
import { AuctionHouse } from './types'
import { TOKEN_PROGRAM_ID, MintInfo, NATIVE_MINT, Token } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'

import { Wallet } from '@metaplex/js'
import { PendingTransaction } from './transaction'

const { instructions } = AuctionHouseProgram
const { createWithdrawFromTreasuryInstruction } = instructions

interface WithdrawTreasuryParams {
  amount: number
}

export class TreasuryClient extends Client {
  private auctionHouse: AuctionHouse

  constructor(
    connection: Connection,
    wallet: Wallet,
    auctionHouse: AuctionHouse
  ) {
    super(connection, wallet)

    this.auctionHouse = auctionHouse
  }

  async balance(): Promise<number> {
    const connection = this.connection
    const wallet = this.wallet
    const auctionHouse = this.auctionHouse
    const treasuryMint = new PublicKey(auctionHouse.treasuryMint)
    const auctionHouseTreasury = new PublicKey(auctionHouse.auctionHouseTreasury)

    const isNative = treasuryMint.equals(NATIVE_MINT)

    try {
      if (isNative) {
        const balance = await connection.getBalance(auctionHouseTreasury)
        const rent = await connection.getMinimumBalanceForRentExemption(0)

        return balance - rent
      }

      const keypair = Keypair.generate()

      const token = new Token(connection, treasuryMint, TOKEN_PROGRAM_ID, keypair)

      const associatedTokenAccount = await token.getAccountInfo(auctionHouseTreasury)

      return associatedTokenAccount.amount.toNumber()
    } catch(e: any) {
      throw new Error(e.message)
    }
  }

  async withdraw({ amount }: WithdrawTreasuryParams): Promise<PendingTransaction> {
    const auctionHouse = this.auctionHouse
    const auctionHouseAddress = new PublicKey(auctionHouse.address)
    const authority = new PublicKey(auctionHouse.authority)
    const treasuryMint = new PublicKey(auctionHouse.treasuryMint)
    const auctionHouseTreasury = new PublicKey(auctionHouse.auctionHouseTreasury)

    const treasuryWithdrawalDestination = new PublicKey(
      auctionHouse.treasuryWithdrawalDestination
    )

    const withdrawFromTreasuryInstructionAccounts = {
      treasuryMint,
      authority,
      treasuryWithdrawalDestination,
      auctionHouseTreasury,
      auctionHouse: auctionHouseAddress,
    }
    const withdrawFromTreasuryInstructionArgs = {
      amount,
    }

    const withdrawFromTreasuryInstruction =
      createWithdrawFromTreasuryInstruction(
        withdrawFromTreasuryInstructionAccounts,
        withdrawFromTreasuryInstructionArgs
      )

    const txt = new Transaction()

    txt.add(withdrawFromTreasuryInstruction)

    return [txt, []]
  }
}
