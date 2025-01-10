import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose } from 'class-transformer'

export class AirportResponseDto {
  @Expose()
  @ApiProperty({ description: 'ID (AIRPORT#{icao})' })
  id: string

  @Expose()
  @ApiProperty({ description: 'ICAO コード' })
  code: string

  @Expose()
  @ApiProperty({ description: '空港名' })
  name: string

  @Expose()
  @ApiProperty({ description: '緯度' })
  latitude: number

  @Expose()
  @ApiProperty({ description: '経度' })
  longitude: number

  @Expose()
  @ApiPropertyOptional({ description: '標高' })
  elevation?: number

  @Expose()
  @ApiProperty({ description: '国コード' })
  country: string

  @Expose()
  @ApiPropertyOptional({ description: '都市名' })
  city?: string

  @Expose()
  @ApiPropertyOptional({ description: '州/県' })
  state?: string

  @Expose()
  @ApiPropertyOptional({ description: '郡/区' })
  county?: string

  @Expose()
  @ApiProperty({ description: 'ICAO コード' })
  icao: string

  @Expose()
  @ApiPropertyOptional({ description: 'IATA コード' })
  iata?: string

  @Expose()
  @ApiPropertyOptional({ description: '都市コード' })
  cityCode?: string

  @Expose()
  @ApiPropertyOptional({ description: 'タイムゾーン' })
  timeZone?: string

  @Expose()
  @ApiProperty({ description: '空港タイプ' })
  type: string

  @Expose()
  @ApiPropertyOptional({ description: 'URL' })
  url?: string
}
