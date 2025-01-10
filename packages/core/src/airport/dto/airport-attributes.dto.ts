import { Type } from 'class-transformer'
import { IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

export class LocationAttributes {
  @IsNumber()
  latitude: number

  @IsNumber()
  longitude: number

  @IsOptional()
  @IsNumber()
  elevation?: number

  @IsString()
  country: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  state?: string

  @IsOptional()
  @IsString()
  county?: string
}

export class CodesAttributes {
  @IsString()
  icao: string

  @IsOptional()
  @IsString()
  iata?: string

  @IsOptional()
  @IsString()
  cityCode?: string
}

export class DetailsAttributes {
  @IsOptional()
  @IsString()
  timeZone?: string

  @IsString()
  type: string

  @IsOptional()
  @IsString()
  url?: string
}

export class AirportAttributes {
  @Type(() => LocationAttributes)
  @ValidateNested()
  @IsObject()
  location: LocationAttributes

  @Type(() => CodesAttributes)
  @ValidateNested()
  @IsObject()
  codes: CodesAttributes

  @Type(() => DetailsAttributes)
  @ValidateNested()
  @IsObject()
  details: DetailsAttributes
}
