import { Test, TestingModule } from '@nestjs/testing';
import { SequencesService } from './sequences.service';
import { DynamoDbService } from '@mbc-cqrs-serverless/core';
import { Logger } from '@nestjs/common';
import { RotateByEnum } from './enums/rotate-by.enum';

describe('SequencesService', () => {
  let service: SequencesService;
  let dynamoDbService: DynamoDbService;
  const mockTableName = 'mockTableName';
  const tenantCode = 'MBC';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequencesService,
        {
          provide: DynamoDbService,
          useValue: {
            getItem: jest.fn(),
            updateItem: jest.fn(),
            getTableName: jest.fn().mockReturnValue(mockTableName),
          },
        },
        Logger,
      ],
    }).compile();

    service = module.get<SequencesService>(SequencesService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get table name on initialization', () => {
    expect(dynamoDbService.getTableName).toHaveBeenCalledWith('sequences');
    expect(service['tableName']).toBe(mockTableName);
  });



  describe('getCurrentSequence', () => {
    it('should call getItem with correct parameters and return the result', async () => {
      const mockKey = { pk: "SEQ#MBC", sk: "TODO#TASK1#2024" };
      const mockResponse = {
        code: "TODO#TASK1#2024",
        updatedBy: "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        createdIp: "127.0.0.1",
        tenantCode: tenantCode,
        type: "TODO",
        createdAt: "2024-11-08T13:50:26+07:00",
        updatedIp: "127.0.0.1",
        createdBy: "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        requestId: "81bf1821-34b0-4dc5-a2ce-685d37d22f8c",
        name: "fiscal_yearly",
        sk: "TODO#TASK1#2024",
        attributes: {
          fiscal_year: 71,
          issued_at: "2024-11-08T13:50:26+07:00",
          formatted_no: "00TASK1-71-code3001"
        },
        pk: "SEQ#MBC",
        seq: 1,
        updatedAt: "2024-11-08T13:50:26+07:00"
      };
      jest.spyOn(dynamoDbService, 'getItem').mockResolvedValue(mockResponse);

      const result = await service.getCurrentSequence(mockKey);
      expect(dynamoDbService.getItem).toHaveBeenCalledWith(mockTableName, mockKey);
      expect(result).toEqual(mockResponse);
    });
  });

  it('should return 68 for a date in November 2021', () => {
    const testDate = new Date('2021-11-15'); // November 2021
    expect(service.getFiscalYear(testDate)).toBe(68);
  });

  it('should return 68 for a date in March 2022 (end of fiscal year 68)', () => {
    const testDate = new Date('2022-03-31'); // March 2022
    expect(service.getFiscalYear(testDate)).toBe(68);
  });

  it('should return 69 for a date in April 2022 (start of fiscal year 69)', () => {
    const testDate = new Date('2022-04-01'); // April 2022
    expect(service.getFiscalYear(testDate)).toBe(69);
  });

  it('should return 69 for a date in December 2022', () => {
    const testDate = new Date('2022-12-01'); // December 2022
    expect(service.getFiscalYear(testDate)).toBe(69);
  });

  it('should return 69 for a date in February 2023 (within fiscal year 69)', () => {
    const testDate = new Date('2023-02-15'); // February 2023
    expect(service.getFiscalYear(testDate)).toBe(69);
  });

  it('should return 70 for a date in April 2023 (start of fiscal year 70)', () => {
    const testDate = new Date('2023-04-01'); // April 2023
    expect(service.getFiscalYear(testDate)).toBe(70);
  });

  it('should return fiscal year when rotateBy is FISCAL_YEARLY', () => {
    const testDate = new Date('2024-02-15'); // February (before April)
    expect(service.getRotateValue(RotateByEnum.FISCAL_YEARLY, testDate)).toBe('2023');

    const testDate2 = new Date('2024-04-15'); // April (new fiscal year)
    expect(service.getRotateValue(RotateByEnum.FISCAL_YEARLY, testDate2)).toBe('2024');
  });

  it('should return year when rotateBy is YEARLY', () => {
    const testDate = new Date('2024-06-15');
    expect(service.getRotateValue(RotateByEnum.YEARLY, testDate)).toBe('2024');
  });

  it('should return year and month when rotateBy is MONTHLY', () => {
    const testDate = new Date('2024-06-15');
    expect(service.getRotateValue(RotateByEnum.MONTHLY, testDate)).toBe('202406');

    const testDate2 = new Date('2024-01-15');
    expect(service.getRotateValue(RotateByEnum.MONTHLY, testDate2)).toBe('202401');
  });

  it('should return year, month, and day when rotateBy is DAILY', () => {
    const testDate = new Date('2024-06-15');
    expect(service.getRotateValue(RotateByEnum.DAILY, testDate)).toBe('20240615');

    const testDate2 = new Date('2024-01-05');
    expect(service.getRotateValue(RotateByEnum.DAILY, testDate2)).toBe('20240105');
  });

  it('should return RotateByEnum.NONE for undefined or unhandled rotateBy', () => {
    expect(service.getRotateValue()).toBe(RotateByEnum.NONE);
    expect(service.getRotateValue(undefined, new Date('2024-06-15'))).toBe(RotateByEnum.NONE);
  });

  it('should return true if rotateBy is not provided', () => {
    const result = service.isIncrementNo(undefined, 2024, 2024, new Date());
    expect(result).toBe(true);
  });

  it('should return true if rotateBy is FISCAL_YEARLY and fiscal year matches', () => {
    const result = service.isIncrementNo(RotateByEnum.FISCAL_YEARLY, 2024, 2024, new Date());
    expect(result).toBe(true);
  });

  it('should return false if rotateBy is FISCAL_YEARLY and fiscal year does not match', () => {
    const result = service.isIncrementNo(RotateByEnum.FISCAL_YEARLY, 2024, 2023, new Date());
    expect(result).toBe(false);
  });
  it('should return false if rotateBy is MONTHLY and issued year does not match current year', () => {
    const issuedAt = new Date('2023-06-15');
    // jest.spyOn(global, 'Date').mockImplementation(() => currentDate);

    const result = service.isIncrementNo(RotateByEnum.MONTHLY, 2024, 2024, issuedAt);
    expect(result).toBe(false);
  });

  it('should return false if rotateBy is MONTHLY and issued month does not match current month but matches year', () => {
    const issuedAt = new Date('2024-05-01');
    const result = service.isIncrementNo(RotateByEnum.MONTHLY, 2024, 2024, issuedAt);
    expect(result).toBe(false);
  });
  it('should return false if rotateBy is YEARLY and issued year does not match current year', () => {
    const issuedAt = new Date('2023-01-15');
    const result = service.isIncrementNo(RotateByEnum.YEARLY, 2024, 2024, issuedAt);
    expect(result).toBe(false);
  });
  it('should return true if rotateBy is YEARLY and issued year matches current year', () => {
    const issuedAt = new Date('2024-01-15');
    const currentDate = new Date('2024-06-15');
    jest.spyOn(global, 'Date').mockImplementation(() => currentDate); // Mock current date

    const result = service.isIncrementNo(RotateByEnum.YEARLY, 2024, 2024, issuedAt);
    expect(result).toBe(true);
  });
  it('should return true if rotateBy is MONTHLY and issued month matches current month and year', () => {
    const issuedAt = new Date();
    const result = service.isIncrementNo(RotateByEnum.MONTHLY, 2024, 2024, issuedAt);
    expect(result).toBe(true);
  });

});
