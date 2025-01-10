import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AirportService } from './airport.service'
import { AirportResponseDto } from './dto/airport-response.dto'

@ApiTags('airports')
@Controller('airports')
export class AirportController {
  constructor(private readonly airportService: AirportService) {}

  @Get(':icao')
  @ApiOperation({ summary: 'ICAO コードで空港を取得' })
  @ApiParam({ name: 'icao', description: 'ICAO コード', type: String })
  @ApiResponse({ 
    status: 200, 
    description: '空港データ',
    type: AirportResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '空港が見つかりません'
  })
  async findByIcao(@Param('icao') icao: string): Promise<AirportResponseDto> {
    const airport = await this.airportService.findByIcao(icao)
    if (!airport) {
      throw new NotFoundException(`Airport with ICAO code ${icao} not found`)
    }
    return airport as AirportResponseDto
  }
}
