import { Test, TestingModule } from '@nestjs/testing';
import { SequencesService } from './sequences.service';
import { DynamoDbService, JwtClaims } from '@mbc-cqrs-serverless/core';
import { Logger } from '@nestjs/common';
import { RotateByEnum } from './enums/rotate-by.enum';
import { FiscalYearOptions } from './interfaces/fiscal-year.interface';
import { SequenceMasterDataProvider } from './sequence-master-factory';
import { SequenceEntity } from './entities/sequence.entity';


const optionsMock = {
  invokeContext: {
    event:{
      requestContext: {
          accountId: '1',
          http: {

              protocol: 'HTTP/1.1',
              sourceIp: '127.0.0.1',
              userAgent: 'PostmanRuntime/7.28.4',
          },
          requestId:'81bf1821-34b0-4dc5-a2ce-685d37d22f8c',
          authorizer: {
              jwt: {
                  claims:{
                    "custom:tenant": 'MBC',
                    "custom:roles": '[{"tenant":"MBC","role":"admin"}]' ,
                  } as JwtClaims
              }
          }
      }
    },
    context: {
      awsRequestId: '81bf1821-34b0-4dc5-a2ce-685d37d22f8c',
    }
  },
}

describe('SequencesService', () => {
  let service: SequencesService;
  let dynamoDbService: DynamoDbService;
  let masterService: SequenceMasterDataProvider;
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
        {
          provide: SequenceMasterDataProvider,
          useValue: {
            getData: jest.fn(),
        },
       },
        Logger,
      ],
    }).compile();

    service = module.get<SequencesService>(SequencesService);
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService);
    masterService = module.get<SequenceMasterDataProvider>(SequenceMasterDataProvider);
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
          formatted_no: "00TASK1-71-code3001",
          no:1
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
  describe('getFiscalYear', () => {
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
  
  })

  describe('getRotateBy', () => {
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
    // it('should return true if rotateBy is YEARLY and issued year matches current year', () => {
    //   const issuedAt = new Date('2024-01-15');
    //   const currentDate = new Date('2024-06-15');
    //   jest.spyOn(global, 'Date').mockImplementation(() => currentDate); // Mock current date
  
    //   const result = service.isIncrementNo(RotateByEnum.YEARLY, 2024, 2024, issuedAt);
    //   expect(result).toBe(true);
    // });
    it('should return true if rotateBy is MONTHLY and issued month matches current month and year', () => {
      const issuedAt = new Date();
      const result = service.isIncrementNo(RotateByEnum.MONTHLY, 2024, 2024, issuedAt);
      expect(result).toBe(true);
    });
  })

  describe('generateSequenceItem', () => {
    it('should call generateSequenceItem with none rotation', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#none",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:44:15+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "7724a67e-ded6-4ebb-9c88-c14070e24012",
        "name": "none",
        "sk": "sequence#TODO#none",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-27T13:44:16+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#none",
        no: 1,
        formattedNo:"1",
        issuedAt:  (new Date("2024-11-27T13:44:16+07:00")),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date: new Date("2024-11-27T13:44:16+07:00"),
          rotateBy: RotateByEnum.NONE,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it('should call generateSequenceItem with none rotation at second time', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#none",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:44:15+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "7724a67e-ded6-4ebb-9c88-c14070e24012",
        "name": "none",
        "sk": "sequence#TODO#none",
        "pk": "SEQ#MBC",
        "seq": 2,
        "updatedAt": "2024-11-27T13:44:16+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#none",
        no: 2,
        formattedNo:"2",
        issuedAt: new Date("2024-11-27T13:44:16+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          date: new Date("2024-11-27T13:44:16+07:00"),  
          params: {
            code1: 'TODO',
          },
          rotateBy: RotateByEnum.NONE,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it ('should call generateSequenceItem with fiscal yearly rotation', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#2024",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:54:04+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "f4c867f7-0b25-439e-896a-d1df1537d589",
        "name": "fiscal_yearly",
        "sk": "sequence#TODO#2024",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-27T13:54:04+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#2024",
        no: 1,
        formattedNo:"1",
        issuedAt: new Date("2024-11-27T13:54:04+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode:  'sequence',
          params: {
            code1: 'TODO',
          },
          date: new Date("2024-11-27T13:54:04+07:00"),
          rotateBy: RotateByEnum.FISCAL_YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with fiscal yearly rotation, argument is a fiscal year that is the same as the previous fiscal year', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#2024",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:54:04+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "f4c867f7-0b25-439e-896a-d1df1537d589",
        "name": "fiscal_yearly",
        "sk": "sequence#TODO#2024",
        "pk": "SEQ#MBC",
        "seq": 2,
        "updatedAt": "2024-11-27T13:54:04+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#2024",
        no: 2,
        formattedNo:"2",
        issuedAt: new Date("2024-11-27T13:54:04+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode  : 'sequence',
          params: {
            code1: 'TODO',
          },
          date: new Date("2024-11-27T13:54:04+07:00"),
          rotateBy: RotateByEnum.FISCAL_YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with fiscal yearly rotation, argument is a fiscal year other than the previous fiscal year', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#2024",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-03-27T13:54:04+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "f4c867f7-0b25-439e-896a-d1df1537d589",
        "name": "fiscal_yearly",
        "sk": "sequence#TODO#2024",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-03-27T13:54:04+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#2024",
        no: 1,
        formattedNo:"1",
        issuedAt: new Date("2024-03-27T13:54:04+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode  : 'sequence',
          params: {
            code1: 'TODO',
          },
          date : new Date("2024-03-27T13:54:04+07:00"),
          rotateBy: RotateByEnum.FISCAL_YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with yearly rotation', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#2024",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:54:04+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "f4c867f7-0b25-439e-896a-d1df1537d589",
        "name": "yearly",
        "sk": "sequence#TODO#2024",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-27T13:54:04+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#2024",
        no: 1,
        formattedNo:"1",
        issuedAt: new Date("2024-11-27T13:54:04+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date : new Date("2024-11-27T13:54:04+07:00"),
          rotateBy: RotateByEnum.YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with  yearly rotation, argument is a  year that is the same as the previous year', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#2024",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:54:04+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "f4c867f7-0b25-439e-896a-d1df1537d589",
        "name": "yearly",
        "sk": "sequence#TODO#2024",
        "pk": "SEQ#MBC",
        "seq": 2,
        "updatedAt": "2024-11-27T13:54:04+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#2024",
        no: 2,
        formattedNo:"2",
        issuedAt: new Date("2024-11-27T13:54:04+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          date : new Date("2024-11-27T13:54:04+07:00"),
          params: {
            code1: 'TODO',
          },
          rotateBy: RotateByEnum.YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with  yearly rotation, argument is a  year other than the previous  year', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#2025",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2025-03-27T13:54:04+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "f4c867f7-0b25-439e-896a-d1df1537d589",
        "name": "yearly",
        "sk": "sequence#TODO#2025",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2025-03-27T13:54:04+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#2025",
        no: 1,
        formattedNo:"1",
        issuedAt: new Date("2025-03-27T13:54:04+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date : new Date("2025-03-27T13:54:04+07:00"),
          rotateBy: RotateByEnum.YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with monthly rotation', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#202411",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:56:39+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "bd482504-6076-46a3-8503-48063f4debd8",
        "name": "monthly",
        "sk": "sequence#TODO#202411",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-27T13:56:39+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#202411",
        no: 1,
        formattedNo:"1",
        issuedAt: new Date("2024-11-27T13:56:39+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          date : new Date("2024-11-27T13:56:39+07:00"),
          params: {
            code1: 'TODO',
          },
          rotateBy: RotateByEnum.MONTHLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with monthly rotation, argument is a month other than the previous month', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#202411",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:56:39+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "bd482504-6076-46a3-8503-48063f4debd8",
        "name": "monthly",
        "sk": "sequence#TODO#202411",
        "pk": "SEQ#MBC",
        "seq": 2,
        "updatedAt": "2024-11-27T13:56:39+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#202411",
        no: 2,
        formattedNo:"2",
        issuedAt: new Date("2024-11-27T13:56:39+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date : new Date("2024-11-27T13:56:39+07:00"),
          rotateBy: RotateByEnum.MONTHLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with monthly rotation, argument is a month that is the same as the previous month', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#202412",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-12-27T13:56:39+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "bd482504-6076-46a3-8503-48063f4debd8",
        "name": "monthly",
        "sk": "sequence#TODO#202412",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-12-27T13:56:39+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#202412",
        no: 1,
        formattedNo:"1",
        issuedAt: new Date("2024-12-27T13:56:39+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date : new Date("2024-12-27T13:56:39+07:00"),
          rotateBy: RotateByEnum.MONTHLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it ('should call generateSequenceItem with daily rotation ', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#20241127",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:56:39+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "bd482504-6076-46a3-8503-48063f4debd8",
        "name": "daily",
        "sk": "sequence#TODO#20241127",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-27T13:56:39+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#20241127",
        no: 1,
        formattedNo:"1",
        issuedAt: new Date("2024-11-27T13:56:39+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date : new Date("2024-11-27T13:56:39+07:00"),
          rotateBy: RotateByEnum.DAILY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it ('should call generateSequenceItem with daily rotation, argument is a day other than the previous day', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#20241127",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T13:56:39+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "bd482504-6076-46a3-8503-48063f4debd8",
        "name": "daily",
        "sk": "sequence#TODO#20241127",
        "pk": "SEQ#MBC",
        "seq": 2,
        "updatedAt": "2024-11-27T13:56:39+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#20241127",
        no: 2,
        formattedNo:"2",
        issuedAt: new Date("2024-11-27T13:56:39+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          date : new Date("2024-11-27T13:56:39+07:00"),
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          rotateBy: RotateByEnum.DAILY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it ('should call generateSequenceItem with daily rotation, the argument is a day that is the same as the previous day', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#20241227",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-12-27T13:56:39+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "bd482504-6076-46a3-8503-48063f4debd8",
        "name": "daily",
        "sk": "sequence#TODO#20241227",
        "pk": "SEQ#MBC",
        "seq": 2,
        "updatedAt": "2024-12-27T13:56:39+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#20241227",
        no: 2,
        formattedNo:"2",
        issuedAt: new Date("2024-12-27T13:56:39+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date : new Date("2024-12-27T13:56:39+07:00"),
          rotateBy: RotateByEnum.DAILY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);

    })
    it('should call generateSequenceItem with none rotation,  the arguments have code 1, code 2, code 3, code4, code5 ', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%code1%%-%%code2%%-%%code3%%-%%code4%%-%%code5%%-%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#ID2#ID3#ID4#ID5#none",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T14:36:18+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "0ff67305-18b6-4a9e-9226-b4f56fec6592",
        "name": "none",
        "sk": "sequence#TODO#ID2#ID3#ID4#ID5#none",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-27T14:36:18+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#ID2#ID3#ID4#ID5#none",
        no: 1,
        formattedNo:"TODO-ID2-ID3-ID4-ID5-1",
        issuedAt: new Date("2024-11-27T13:44:16+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          rotateBy: RotateByEnum.NONE,
          date: new Date("2024-11-27T13:44:16+07:00"),
          params: {
            code1: 'TODO',
            code2: 'ID2',
            code3: 'ID3',
            code4: 'ID4',
            code5: 'ID5',
          },
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it('should call generateSequenceItem with none rotation,  format is %%code1%%-%%fiscal_year%%-%%no%%', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%code1%%-%%fiscal_year%%-%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#ID2#ID3#ID4#ID5#none",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T14:36:18+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "0ff67305-18b6-4a9e-9226-b4f56fec6592",
        "name": "none",
        "sk": "sequence#TODO#ID2#ID3#ID4#ID5#none",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-27T14:36:18+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#ID2#ID3#ID4#ID5#none",
        no: 1,
        formattedNo:"TODO-72-1",
        issuedAt: new Date("2024-11-27T13:44:16+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          date: new Date("2024-11-27T13:44:16+07:00"),
          rotateBy: RotateByEnum.NONE,
          params: {
            code1: 'TODO',
            code2: 'ID2',
            code3: 'ID3',
            code4: 'ID4',
            code5: 'ID5',
          },
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it('should call generateSequenceItem with none rotation,  format is %%code1%%-%%month%%-%%no%%', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%code1%%-%%month%%-%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#none",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-06-13T13:44:16+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "0ff67305-18b6-4a9e-9226-b4f56fec6592",
        "name": "none",
        "sk": "sequence#TODO#none",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-06-13T13:44:16+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#none",
        no: 1,
        formattedNo:"TODO-6-1",
        issuedAt: new Date("2024-06-13T13:44:16+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          rotateBy: RotateByEnum.YEARLY,
          date: new Date("2024-06-13T13:44:16+07:00"),
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it('should call generateSequenceItem with none rotation,  format is %%code1%%-%%day%%-%%no%%', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%code1%%-%%day%%-%%no%%',
      }
      const mockUpdate ={
        "code": "sequence#TODO#none",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-15T14:36:18+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "0ff67305-18b6-4a9e-9226-b4f56fec6592",
        "name": "none",
        "sk": "sequence#TODO#none",
        "pk": "SEQ#MBC",
        "seq": 1,
        "updatedAt": "2024-11-15T14:36:18+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#TODO#none",
        no: 1,
        formattedNo:"TODO-15-1",
        issuedAt: new Date("2024-11-15T13:44:16+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'TODO',
          },
          date: new Date("2024-11-15T13:44:16+07:00"),
          rotateBy: RotateByEnum.YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
    it('should call generateSequenceItem with register date,  format is %%code1%%-%%fiscal_year%%-%%no%%', async () => {
      const mockMasterData = {
        typeCode: 'sequence',
        format: '%%code1%%-%%fiscal_year%%-%%no%%',
        registerDate: new Date("2020-01-01"),
      }
      const mockUpdate ={
       "code": "sequence#PI#2024",
        "updatedBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "createdIp": "127.0.0.1",
        "tenantCode": "MBC",
        "type": "sequence",
        "createdAt": "2024-11-27T17:45:45+07:00",
        "updatedIp": "127.0.0.1",
        "createdBy": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
        "requestId": "9fc8d555-f200-4f5d-b3e0-07d2fa9dcd16",
        "name": "fiscal_yearly",
        "sk": "sequence#PI#2024",
        "pk": "SEQ#MBC",
        "seq": 2,
        "updatedAt": "2024-11-27T17:46:36+07:00"
      }
      jest.spyOn(masterService, 'getData').mockResolvedValue(mockMasterData);
      jest.spyOn(dynamoDbService, 'updateItem').mockResolvedValue(mockUpdate);
      const mockSequenceResponse = new SequenceEntity({
        id: "SEQ#MBC#sequence#PI#2024",
        no: 2,
        formattedNo:"PI-5-2",
        issuedAt: new Date("2024-11-27T17:46:36+07:00"),
      })
      const result = await service.generateSequenceItem(
        {
          tenantCode: tenantCode,
          typeCode: 'sequence',
          params: {
            code1: 'PI',
          },
          date: new Date("2024-11-27T17:46:36+07:00"),
          rotateBy: RotateByEnum.FISCAL_YEARLY,
        },
        optionsMock
      );
      expect(result).toEqual(mockSequenceResponse);
    })
  });

});
