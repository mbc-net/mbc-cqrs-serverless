export class SequenceEntity {
  id: string
  no: number
  formattedNo: string
  issuedAt: Date

  constructor(partial: Partial<SequenceEntity>) {
    Object.assign(this, partial)
  }
}
