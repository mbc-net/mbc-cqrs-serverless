import { Test, TestingModule } from '@nestjs/testing';
import { SequencesService } from './sequences.service';
import { DynamoDbService } from '@mbc-cqrs-serverless/core';
import { Logger } from '@nestjs/common';
import { RotateByEnum } from './enums/rotate-by.enum';
import { FiscalYearOptions } from './interfaces/fiscal-year.interface';

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

  // Case 1: Default start month (April) and reference year 1953
  it('should calculate the fiscal year using default start month (April) and reference year 1953', () => {
    const options: FiscalYearOptions = { now: new Date('2024-03-15') }; // Before the fiscal year starts (April 1)
    const result = service.getFiscalYear(options);
    expect(result).toBe(71); // 2023 fiscal year, since 2024-2023 = 1, starting from 1953
  });

  // Case 2: Custom start month (e.g., July)
  it('should calculate the fiscal year using a custom start month (July)', () => {
    const options: FiscalYearOptions = { now: new Date('2024-03-15'), startMonth: 7 };
    const result = service.getFiscalYear(options);
    expect(result).toBe(71); // The fiscal year 2023 ends on June 30, 2024
  });

  // Case 3: Custom register time (e.g., starting from 2020)
  it('should calculate the fiscal year using a custom register time (2020)', () => {
    const options: FiscalYearOptions = {
      now: new Date('2024-03-15'),
      registerTime: new Date('2020-05-01'),
    };
    const result = service.getFiscalYear(options);
    expect(result).toBe(4);
  });

  // Case 4: Custom register time and custom start month (e.g., July)
  it('should calculate the fiscal year using a custom register time and start month (July)', () => {
    const options: FiscalYearOptions = {
      now: new Date('2024-03-15'),
      registerTime: new Date('2020-05-01'),
      startMonth: 7,
    };
    const result = service.getFiscalYear(options);
    expect(result).toBe(4); 
  });

  // Case 5: `now` exactly matches the start of the fiscal year (April 1)
  it('should handle the case where now is exactly the start of the fiscal year', () => {
    const options: FiscalYearOptions = { now: new Date('2024-04-01') }; // First day of fiscal year
    const result = service.getFiscalYear(options);
    expect(result).toBe(72); // 2024 fiscal year (72nd fiscal year since 1953)
  });

  // Case 6: `now` is just before the start of the fiscal year (March 31)
  it('should handle the case where now is just before the fiscal year starts', () => {
    const options: FiscalYearOptions = { now: new Date('2024-03-31') }; // Day before fiscal year starts
    const result = service.getFiscalYear(options);
    expect(result).toBe(71); // Fiscal year 2023 (71st fiscal year since 1953)
  });

  // Case 7: `now` is in the next fiscal year, but before the start month
  it('should calculate the fiscal year when now is after the fiscal year start, but before the start month', () => {
    const options: FiscalYearOptions = {
      now: new Date('2024-06-01'), // After fiscal year start (April) but before custom start month (July)
      startMonth: 7,
      registerTime: new Date('2019-01-01'),
    };
    const result = service.getFiscalYear(options);
    expect(result).toBe(6); // Fiscal year 2024, counting from 2019 + 1 = 6
  });

  // Case 8: Handle future registerTime (later than now)
  it('should return a negative fiscal year when registerTime is in the future', () => {
    const options: FiscalYearOptions = {
      now: new Date('2024-11-18'),
      registerTime: new Date('2025-05-01'), // Future register date
    };
    const result = service.getFiscalYear(options);
    expect(result).toBe(0); // 2024 fiscal year is negative compared to future registerTime
  });

  // Case 9: `now` and `registerTime` in the same fiscal year
  it('should return fiscal year 1 when now and registerTime fall within the same fiscal year', () => {
    const options: FiscalYearOptions = {
      now: new Date('2024-10-01'),
      registerTime: new Date('2024-05-01'),
    };
    const result = service.getFiscalYear(options);
    expect(result).toBe(1); // Same fiscal year (2024) as registerTime
  });

  // Case 10: No startMonth or registerTime, using defaults (1953)
  it('should return the fiscal year using defaults (starting from 1953)', () => {
    const options: FiscalYearOptions = { now: new Date('2024-11-18') }; // No startMonth or registerTime
    const result = service.getFiscalYear(options);
    expect(result).toBe(72); // 2023 fiscal year, starting from 1953
  });

  // Case 11: Very early registerTime and no startMonth
  it('should return a high fiscal year number when registerTime is very early (e.g., 1900)', () => {
    const options: FiscalYearOptions = {
      now: new Date('2024-11-18'),
      registerTime: new Date('1900-01-01'), // Register date far in the past
    };
    const result = service.getFiscalYear(options);
    expect(result).toBe(125);
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
