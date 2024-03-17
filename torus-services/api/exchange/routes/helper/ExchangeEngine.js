/**
 * @Description     : Exchange Engine
 * @Last_Error_Code : ERR-EXG-120032
 * 
 */

// Require dependenciess
var dir_path = '../../../../../'
var modPath = dir_path + 'node_modules/'
var refPath = dir_path + 'torus-references/'
var reqInstanceHelper = require(refPath + 'common/InstanceHelper')
var reqFXDBInstance = require(refPath + 'instance/DBInstance')
var commonFile = require('../util/Common.js')
var async = require(modPath + 'async')
var momentInstance = require(modPath + 'moment')
var fs = require('fs')
var ftpHelper = require('./FTPHelper');
var commonAdapter = require('../adapter/CommonAdapter')
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var path = require('path');
var headers = '';
var reqExchangeHelper = require('./ExchangeHelper');
var serviceName = "Exchange Engine";
/**
 * @description - Core engine method for data formatting and data cleaning
 * @param ruleObj - JSONOBJECT - Holds the rule by wich the data need to be transformed
 * @param selectedDataArr - JSONArray - Data from WfSelect
 * @param callBackExchangeEngine - JSONOBJECT - Response Object
 */
function ExchangeEngine(inputData, callBackExchangeEngine) {
  var process = inputData.process
  headers = inputData["headers"];
  if (inputData["originalRequest"] == undefined) {
    originalUrl = ""
  } else {
    originalUrl = inputData["originalRequest"].originalUrl;
  }
  if (process === 'EXPORT') {
    var is_custom_code_applicable = inputData.is_custom_code_applicable || false
    var ruleObj = inputData.ruleObj
    var selectedDataArr = inputData.selectedData

    async.forEachOf(ruleObj['FILE_FORMATS'], function (value, key, callbackAsync) {


      // Note : currently we assumed there is only one file format 
      ruleObj['FILE_FORMATS'] = ruleObj['FILE_FORMATS'].sort(function (a, b) {
        return Number(a.SORTORDER) - Number(b.SORTORDER)
      })



      // to be implemented
      var maximum_count = ''
      maximum_count = getMaxCount(value['RECORD_FORMATS']);

      processFileFormat(value, inputData).then((responseff) => {
        var fileFormatObj = responseff;

        if (!is_custom_code_applicable) {
          // Record format object 
          var recordFormatObj = {}
          var recordFormats = value['RECORD_FORMATS']

          var recordFormatSeparator = value['SEPERATOR'] || value['seperator']
          var customSeparator = value['CUSTOM_SEPERATOR'] || "";

          // To process record format of the file format
          recordFormatObj = processRecordFormats(recordFormats, selectedDataArr, recordFormatSeparator, customSeparator)
          // Call the corresponding Adapter file ex Text or JSON or CSV
          if (value['HANDLER_CODE'] == '') {
            resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120027', 'Handler Code Missing', '', '', '')
            return callbackAsync()
          }

          var adapter = require('../adapter/' + value['HANDLER_CODE'])
          //var adapter = require('../adapter/xmlAdapter');

          // Prepare Adapter object
          var adapterObj = {
            'FILE_FORMAT_OBJ': fileFormatObj,
            'RECORD_DATA_OBJ': recordFormatObj,
            'MAXIMUM_COUNT': maximum_count,
            "ORG_DATA": inputData.selectedData

          }
          // Execute adapter main method to obtain the content relevant to adapter format ex json,txt
          var processedData = adapter.ExecuteMain(adapterObj)

          // processedData.adapterObj = adapterObj
          // Now write the content to correspondign file ex:.json,.txt
          if (inputData.WRITE_METHOD === 'INSTANCE') {
            var res = {};
            var totalInstantFileNames = [];
            var splitFile = '';
            var fileName = '';
            commonAdapter.checkFolderExists(path.resolve("./temp/"), function (resnewPath) {
              inputData.storagePath = resnewPath;
              console.log('fileFormatObj[FILE_NAME] *************', fileFormatObj['FILE_NAME']);
              adapter.WriteToFile(processedData, inputData, fileFormatObj['FILE_NAME'], function (response) {
                console.log('Adaptor response', response);
                if (response.STATUS == "SUCCESS") {
                  async.forEachOfSeries(processedData.actualFileContent, function (fileContent, index, fileWritedCB) {
                    if (processedData.length > 1) {
                      splitFile = fileFormatObj['FILE_NAME'].split(".");
                      fileName = splitFile[0] + '_' + index + '.' + splitFile[1];
                    } else {
                      fileName = fileFormatObj['FILE_NAME'];
                    }
                    totalInstantFileNames.push(fileName);
                    console.log('total Instant File Names', totalInstantFileNames.toString());
                    fs.writeFile(path.join(resnewPath, fileName), fileContent, function (err) {
                      if (err) {
                        commonFile.PrintInfo('File writing process Failed in ' + path.join(resnewPath, fileName) + ' due to ' + JSON.stringify(err));
                      }
                      fileWritedCB();
                    });
                  }, function () {
                    adapterObj.FILE_FORMAT_OBJ.FILE_NAME = totalInstantFileNames;
                    res.adapterObj = adapterObj;
                    resObj = commonFile.prepareMethodResponse('SUCCESS', '', res, '', '', '', '', '');
                    callbackAsync();
                  });
                } else {
                  fileName = fileFormatObj['FILE_NAME'];
                  totalInstantFileNames.push(fileName);
                  adapterObj.FILE_FORMAT_OBJ.FILE_NAME = totalInstantFileNames;
                  resObj = response;
                  callbackAsync()
                }
              });
            });
          } else {
            if (inputData.storagePath) {
              var selected_files = []
              commonFile.PrintInfo('File writing process started in path ' + inputData.storagePath + fileFormatObj['FILE_NAME'])

              commonAdapter.checkFolderExists(inputData.storagePath, function () {

                adapter.WriteToFile(processedData, inputData, fileFormatObj['FILE_NAME'], function (response) {
                  if (response.STATUS == 'FAILURE') {
                    resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120032', 'Failed to write file', '', '', '')
                    return callBackExchangeEngine(resObj)
                  } else {
                    console.log("gateway_config", JSON.stringify(inputData.gateway_config))
                    if (inputData.gateway_config["STATUS"] != "FAILURE" && inputData.gateway_config.SUCCESS_DATA && inputData.gateway_config.SUCCESS_DATA.gateway_type != "Local") {
                      console.log("Inside If")
                      inputData.gateway_config.SUCCESS_DATA.read_path = inputData.storagePath,
                        // inputData.gateway_config.SUCCESS_DATA.writepath = inputData.PATH,
                        gateway_config = inputData.gateway_config.SUCCESS_DATA
                      inputData.gateway_config.SUCCESS_DATA.log_info = inputData.objLogInfo;
                      selected_files.push(fileFormatObj['FILE_NAME'])
                      ftpHelper.uploadLocalToFTP(selected_files, inputData.gateway_config.SUCCESS_DATA, inputData.storagePath, function (result) {

                        if (result.STATUS == "FAILURE") {
                          resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120032', result.ERROR_MESSAGE, '', '', '')
                          return callBackExchangeEngine(resObj)
                        } else {
                          var res = {}
                          res.adapterObj = adapterObj
                          res.files = response.SUCCESS_DATA;
                          resObj = commonFile.prepareMethodResponse('SUCCESS', '', res, '', '', '', '', '')
                          callbackAsync()
                        }
                      })
                    } else {

                      var res = {};
                      // Adding File name for each tran created in the same file for ex_file_tran entry
                      var maxCount = adapterObj.MAXIMUM_COUNT ? parseInt(adapterObj.MAXIMUM_COUNT) : null;
                      var createdFileNameIndex = 0;
                      var currentEligibleDataCount = 0;
                      for (let d = 1; d <= adapterObj.ORG_DATA.length; d++) {
                        const element = adapterObj.ORG_DATA[(d - 1)];
                        element.FileName = response.SUCCESS_DATA[createdFileNameIndex];
                        currentEligibleDataCount++;
                        if (currentEligibleDataCount == maxCount) {
                          createdFileNameIndex++;
                          currentEligibleDataCount = 0;
                        }
                      }

                      res.adapterObj = adapterObj;
                      res.files = response.SUCCESS_DATA;
                      resObj = commonFile.prepareMethodResponse('SUCCESS', '', res, '', '', '', '', '');
                      callbackAsync();
                    }


                  }

                })
              })
            } else {
              resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120027', 'Path Setup missing', '', '', '')
              callbackAsync()
            }
          }
        } else {
          var ccRule = inputData.ccrule

          // Call custom write method to execute custom logic
          /* delete require.cache[require.resolve('../../ide_services/' + ccRule['PROJECT_NAME'] + '/' + 'writeData' + ".js")]
          var objCC = require('../../ide_services/' + ccRule['PROJECT_NAME'] + '/' + 'writeData' + ".js") */
          var codeSnippetInputParams = {};
          codeSnippetInputParams["SETUP"] = inputData;
          codeSnippetInputParams["headers"] = inputData["headers"];
          codeSnippetInputParams["TranDB"] = inputData.tran_db_instance;
          codeSnippetInputParams["PRCT_ID"] = inputData.objLogInfo.PROCESS_INFO.PRCT_ID;
          codeSnippetInputParams["session_info"] = inputData.SESSION;
          codeSnippetInputParams['objLogInfo'] = inputData.objLogInfo;
          codeSnippetInputParams["PROCESSED_DATA"] = ccRule["PROCESSED_DATA"] || {};
          codeSnippetInputParams["PROCESSED_DATA"]["FILTERS"] = inputData["FILTERS"];
          codeSnippetInputParams["PROCESSED_DATA"]["SEARCH_PARAMS"] = inputData["SEARCH_PARAMS"];
          if (!codeSnippetInputParams.PROCESSED_DATA || !codeSnippetInputParams.PROCESSED_DATA.length) {
            codeSnippetInputParams["PROCESSED_DATA"] = [{ tran_id: 0 }]; // Added Static Eligible Tran for Making Dummy Windows Service Call to Process the Recovery Logs
            /* resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120028', 'There is no Eligible Record...', '', '', '')
            return callBackExchangeEngine(resObj); */
          }
          // objCC['writeData'](objInput, function (callbackCC) {
          codeSnippetInputParams["EXG_ADDITIONAL_PARAMS"] = inputData.exg_additional_params;
          var callCodeSnippetParam = {};
          callCodeSnippetParam.objLogInfo = objLogInfo;
          callCodeSnippetParam.FFG_JSON = inputData.ruleObj;
          callCodeSnippetParam.EXG_PROCESS_NAME = 'CREATE';
          callCodeSnippetParam.CODE_SNIPPET_INPUT_PARAMS = codeSnippetInputParams;
          CallCodeSnippetByFFGCode(callCodeSnippetParam, function (callbackCC, error) {


            if (inputData.WRITE_METHOD === 'INSTANCE') {
              commonAdapter.checkFolderExists(path.resolve("./temp/"), function (resnewPath) {
                inputData.PATH = resnewPath
                fs.writeFile(path.join(resnewPath, fileFormatObj['FILE_NAME']), callbackCC, function (err) {
                  if (err) {
                    commonFile.PrintInfo('File writing process Failed in ' + path.join(resnewPath, fileFormatObj['FILE_NAME']) + ' due to ' + JSON.stringify(err));
                  }
                  resObj = commonFile.prepareMethodResponse('SUCCESS', '', fileFormatObj['FILE_NAME'], '', '', '', '', '')
                  return callBackExchangeEngine(resObj)
                });
              });
            } else {
              resObj = commonFile.prepareMethodResponse(callbackCC.STATUS, 'STATIC', callbackCC, '', '', '', '', '')
              return callBackExchangeEngine(resObj)
            }
          })
        }
      }).catch((ex) => {
        resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120027', 'Error while forming file name', ex, '', '')
        return callBackExchangeEngine(resObj)
      })
    }, function (err) {
      if (err) {
        resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120027', 'Error while executing multiple file formats', err, '', '')
        return callBackExchangeEngine(resObj)
      } else {
        return callBackExchangeEngine(resObj)
      }
    })

  } else if (process === 'TRANSFER') {
  } else if (process === 'IMPORT') {
    try {
      var ffg_json = inputData.ruleObj
      var SESSION_ID = inputData.headers['session-id'];
      var ROUTING_KEY = inputData.headers['routingkey'];
      var app_id = inputData.originalRequest.session.APP_ID
      var u_id = inputData.originalRequest.session.U_ID
      var importFileReqObj = inputData.importFileReqObj
      var originalRequest = inputData.originalRequest
      var objLogInfo = inputData['objLogInfo'];
      var is_custom_code_applicable = inputData.is_custom_code_applicable || false

      reqInstanceHelper.PrintInfo(serviceName, "Is Custom Code Avaialble " + is_custom_code_applicable, objLogInfo);

      if (is_custom_code_applicable) {
        // Call custom write method to execute custom logic
        var codeSnippetInputParams = {};
        codeSnippetInputParams["ffg_json"] = inputData["ruleObj"];
        codeSnippetInputParams["files"] = inputData["importFileReqObj"];
        codeSnippetInputParams["originalUrl"] = inputData.originalRequest.originalUrl;
        codeSnippetInputParams["default_params"] = inputData["DEFAULT_PARAMS"]
        codeSnippetInputParams["headers"] = inputData["headers"];
        codeSnippetInputParams["TranDB"] = inputData.originalRequest.tran_db_instance;
        codeSnippetInputParams["PRCT_ID"] = objLogInfo.PROCESS_INFO.PRCT_ID;
        codeSnippetInputParams["session_info"] = inputData.originalRequest.session;
        codeSnippetInputParams["file_info"] = inputData["FILE_INFO"];
        codeSnippetInputParams["gateway_setup"] = inputData.originalRequest.gateway_config || "";
        codeSnippetInputParams['objLogInfo'] = objLogInfo;
        codeSnippetInputParams["continue_process"] = inputData["continue_process"];

        var callCodeSnippetParam = {};
        callCodeSnippetParam.objLogInfo = objLogInfo;
        callCodeSnippetParam.FFG_JSON = inputData.ruleObj;
        callCodeSnippetParam.EXG_PROCESS_NAME = 'UPDATE';
        callCodeSnippetParam.CODE_SNIPPET_INPUT_PARAMS = codeSnippetInputParams;
        CallCodeSnippetByFFGCode(callCodeSnippetParam, function (callbackCC, error) {
          // if (callbackCC.STATUS == 'FAILURE') {
          if ((callbackCC.STATUS == 'FAILURE' && callbackCC.WRITE_RECOVERY_LOG) || error) {
            reqInstanceHelper.PrintInfo(serviceName, 'Custome Code Response is FAILURE....', objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'So Going to Empty the PRCT_Id from EX_HEADER_FILES Table - ' + codeSnippetInputParams.PRCT_ID, objLogInfo);
            var condObj = {
              'PRCT_ID': codeSnippetInputParams.PRCT_ID,
              'FILE_STATUS': 'DOWNLOADED'
            };
            var updateColumn = {
              'PRCT_ID': ''
            };
            reqTranDBInstance.UpdateTranDBWithAudit(codeSnippetInputParams["TranDB"], 'EX_HEADER_FILES', updateColumn, condObj, objLogInfo, function (result, error) {
              if (error) {
                reqInstanceHelper.PrintInfo(serviceName, "inputData.originalRequest.isStaticTran - " + inputData.originalRequest.isStaticTran, objLogInfo);
                if (inputData.originalRequest.isStaticTran) {
                  reqInstanceHelper.PrintInfo(serviceName, "Updating Prct to Null Process Skipped due to the Static Tran Added for Dummy Windows Service Call...", objLogInfo);
                  var resObj = commonFile.prepareMethodResponse('SUCCESS', 'STATIC', callbackCC, '', '', '', '', '');
                  return callBackExchangeEngine(resObj);
                }
                // Writing Service log file
                var objProcessedFile = {
                  File_Down_Null_Prct_ID_Process: {
                    condObj, updateColumn
                  }
                };
                var folderPath = inputData.originalRequest.SERVICE_LOG_FOLDER_PATH;
                var fileContent = JSON.stringify(objProcessedFile);
                var fileName = reqInstanceHelper.GetServiceFileName(headers);
                reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent, function (result) {
                });
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120059', 'PRCT_ID update or making NULL in the EX_HEADER_FILES Table is Failed...', error);
                var resObj = commonFile.prepareMethodResponse('SUCCESS', 'STATIC', callbackCC, '', '', '', '', '');
                return callBackExchangeEngine(resObj);

              } else {
                reqInstanceHelper.PrintInfo(serviceName, 'Successfully Updated PRCT_ID or making NULL in the EX_HEADER_FILES Table...', objLogInfo);
                var resObj = commonFile.prepareMethodResponse('SUCCESS', 'STATIC', callbackCC, '', '', '', '', '');
                return callBackExchangeEngine(resObj);
              }
            });
          } else {
            var resObj = commonFile.prepareMethodResponse('SUCCESS', 'STATIC', callbackCC, '', '', '', '', '');
            return callBackExchangeEngine(resObj);
          }

        });
      } else {
        var recordFormat = ffg_json['FILE_FORMATS'][0]['RECORD_FORMATS'][0]
        var dep_cs_instance = inputData.originalRequest.dep_cas_instance
        var dev_cas_instance = inputData.originalRequest.dev_cas_instance
        var objLogInfo = originalRequest.objLogInfo
        var dfault_params = inputData["DEFAULT_PARAMS"] || []
        var status = "CREATED"
        var process_status = "CREATED"
        var Need_DTT_Validation = recordFormat["Need_DTT_Validation"] || false;
        var fieldFormats = recordFormat["FIELD_FORMATS"];
        var fieldArr = [];
        for (var i = 0; i < fieldFormats.length; i++) {
          if (fieldFormats[i] != "" && fieldFormats[i] != undefined) {
            var fieldObj = {};
            fieldObj["value_field"] = fieldFormats[i]["value_field"];
            fieldObj["disp_field"] = fieldFormats[i]["disp_field"];
            fieldObj["ctrltype"] = fieldFormats[i]["ctrltype"];
            fieldObj["length"] = fieldFormats[i]["length"];
            fieldArr.push(fieldObj);
          }
        }

        var handler_code = ffg_json['FILE_FORMATS'][0]["HANDLER_CODE"];
        var adapter = require('../adapter/' + handler_code)
        var dt_code = recordFormat['DT_Code'] || recordFormat['Dt_code'];
        var dtt_code = (recordFormat.cs_group && Object.keys(recordFormat.cs_group).length && recordFormat.cs_group[0].DTT_Code) || recordFormat['DTT_Code'] || recordFormat['Dtt_code'];
        var app_id = originalRequest['session']['APP_ID'] || '';

        getDTDTTInfo(app_id, dt_code, dtt_code, dep_cs_instance, objLogInfo, function (columnResponse) {
          var meta = []
          if (columnResponse.STATUS == "SUCCESS") {
            var customValidationDetail = [];
            for (var index = 0; index < fieldFormats.length; index++) {
              var value_field = fieldFormats[index]['value_field']
              var disp_field = fieldFormats[index]['disp_field']
              var field_format_type = fieldFormats[index]['ctrltype']
              var obj = {}
              obj['TARGET_COLUMN'] = value_field
              obj['CTLR_CODE'] = ''
              obj['DATA_TYPE'] = field_format_type
              var custObj = {};
              if (fieldFormats[index]["cus_val_project_code"] != undefined && fieldFormats[index]["cus_val_project_code"] != "") {
                custObj["cus_val_project_code"] = fieldFormats[index]["cus_val_project_code"];
                custObj["cus_val_project_name"] = fieldFormats[index]["cus_val_project_name"];
                custObj["cus_val_project_info"] = JSON.parse(fieldFormats[index]["cus_val_project_info"]);
                custObj["value_field"] = value_field;
                custObj["disp_field"] = disp_field;
                customValidationDetail.push(custObj);
              }
              meta.push(obj)
            }
            if (dfault_params.length > 0) {
              for (var index = 0; index < dfault_params.length; index++) {
                var obj = {}
                obj['TARGET_COLUMN'] = dfault_params[index]["target_column"].toUpperCase()
                obj['CTLR_CODE'] = ''
                obj['DATA_TYPE'] = dfault_params[index]["data_type"].toUpperCase()
                meta.push(obj)
              }
            }

            var dtt_dfd_json = JSON.parse(escapeSpecialChars(columnResponse.DATA[0]["dtt_dfd_json"].replace(/\\/g, '')))
            for (var i = 0; i < meta.length; i++) {
              for (var j = 0; j < dtt_dfd_json.DATA_FORMATS[0].DF_DETAILS.length; j++) {
                if (meta[i].TARGET_COLUMN == dtt_dfd_json.DATA_FORMATS[0].DF_DETAILS[j].TARGET_COLUMN) {
                  meta[i].DATA_TYPE = dtt_dfd_json.DATA_FORMATS[0].DF_DETAILS[j].DATA_TYPE
                  for (var k = 0; k < fieldFormats.length; k++) {
                    if (meta[i].TARGET_COLUMN == fieldFormats[k]["value_field"]) {
                      fieldFormats[k]["ctrltype"] = meta[i].DATA_TYPE
                    }

                  }
                }
              }
            }
            commonFile.GetKeyColumn(dep_cs_instance, app_id, dt_code, dtt_code, objLogInfo, function (responseKeyColumn) {
              var reqSaveTranArr = [];
              var errorDataArr = [];
              adapter.GetOriginalData(inputData, function (respData) {
                var jsonDataResponse = respData
                var fileName = "";
                var FIELD_FORMATS = jsonDataResponse.FIELD_FORMATS
                var TOTAL_DATA = jsonDataResponse.TOTAL_DATA
                try {
                  fileName = TOTAL_DATA[0][0]["_FILE_SETUP_NAME_"] || "";
                } catch (ex) {

                }
                for (var i = 0; i < TOTAL_DATA[0].length; i++) {
                  delete TOTAL_DATA[0][i]["_FILE_SETUP_NAME_"];
                }

                for (var index = 0; index < TOTAL_DATA.length; index++) {
                  var items = TOTAL_DATA[index]
                  for (var i = 0; i < TOTAL_DATA[0].length; i++) {
                    delete TOTAL_DATA[0][i]["_FILE_SETUP_NAME_"];
                  }


                  if (columnResponse.DATA[0]["dtt_dfd_json"] != "") {
                    var dtValidation = validateDtData(items, JSON.parse(escapeSpecialChars(columnResponse.DATA[0]["dtt_dfd_json"].replace(/\\/g, ''))), fieldArr, Need_DTT_Validation);
                  }

                }
                for (var i = 0; i < TOTAL_DATA[0].length; i++) {
                  if (dfault_params.length > 0) {
                    for (var index = 0; index < dfault_params.length; index++) {
                      var binding_column = dfault_params[index]["target_column"].toUpperCase()
                      TOTAL_DATA[0][i][binding_column] = dfault_params[index]["value"]

                      if (binding_column.toUpperCase() == "STATUS") {
                        status = dfault_params[index]["value"]

                      } else if (binding_column.toUpperCase() == "PROCESS_STATUS") {
                        process_status = dfault_params[index]["value"]
                      }
                    }
                  }
                  for (var idx = 0; idx < fieldFormats.length; idx++) {
                    if (fieldFormats[idx]['Field_Format_Type'] == "S") {
                      if (fieldFormats[idx]["value_field"].toUpperCase() == "STATUS") {
                        status = fieldFormats[idx]["disp_field"]

                      } else if (fieldFormats[idx]["value_field"].toUpperCase() == "PROCESS_STATUS") {
                        process_status = fieldFormats[idx]["disp_field"]
                      } else {
                        TOTAL_DATA[0][i][fieldFormats[idx]["value_field"]] = fieldFormats[idx]["disp_field"]
                      }
                    }

                  }

                }

                customValidationPreparation(dep_cs_instance, customValidationDetail, items, function (responseCustomValidation) {
                  if (responseCustomValidation != undefined && responseCustomValidation.length > 0) {
                    for (var rcv = 0; rcv < responseCustomValidation.length; rcv++) {
                      if (responseCustomValidation[rcv]["VALIDATION_STATUS"] == "FAILURE") {
                        dtValidation["VALIDATED_DATA"].push(responseCustomValidation[rcv]);
                        dtValidation["STATUS"] = "FAILURE";
                      }
                    }
                  }
                  if (dtValidation.STATUS == "SUCCESS") {
                    var inputData = {};
                    var fileNames = [];
                    var saveTranRequest = {}
                    saveTranRequest['UICGC_CODE'] = originalRequest.UICGC_CODE
                    saveTranRequest['HANDLER_CODE'] = 'SAVE_TRAN'
                    saveTranRequest['APP_ID'] = app_id
                    saveTranRequest['DT_CODE'] = recordFormat['DT_Code'] || recordFormat['Dt_code']
                    saveTranRequest['DTT_CODE'] = recordFormat['DTT_Code'] || recordFormat['Dtt_code']
                    saveTranRequest['EVENT_CODE'] = originalRequest.EVENT_CODE
                    saveTranRequest['JSON_DATASET'] = [{
                      'DT_Code': recordFormat['DT_Code'] || recordFormat['Dt_code'],
                      'DTT_Code': recordFormat['DTT_Code'] || recordFormat['Dtt_code'],
                      'Key_Column': '',
                      'Items': TOTAL_DATA[0],
                      'PWDCtrls': '',
                      'DecCtrls': '',
                      'Status': status,
                      'ProcessStatus': process_status,
                      'Has_status': 'N',
                      'Has_processStatus': 'N',
                      'Meta': meta,
                      'MultiSelectedItem': false
                    }]
                    saveTranRequest['KEYCOLUMN'] = '';
                    saveTranRequest['TRN_ID'] = 0;
                    saveTranRequest['STATUS'] = status;
                    saveTranRequest['PROCESS_STATUS'] = process_status;
                    saveTranRequest['TS_ID'] = 0;
                    saveTranRequest["U_ID"] = u_id;

                    var requestObj = {};
                    requestObj['SESSION_ID'] = SESSION_ID;
                    requestObj['ROUTING_KEY'] = ROUTING_KEY;
                    requestObj['PARAMS'] = saveTranRequest;
                    requestObj['LOGINFO'] = '';
                    requestObj['PROCESS_INFO'] = objLogInfo.PROCESS_INFO;

                    inputData["requestObj"] = requestObj;
                    inputData["fileName"] = fileName
                    fileNames.push(fileName);
                    reqSaveTranArr.push(requestObj);
                    var commonAdapter = require('../adapter/CommonAdapter');
                    var tranDetArr = [];
                    //  async.forEachOf(reqSaveTranArr, function (value, key, callbackAsync) {
                    // var reqData = value["requestObj"];
                    commonAdapter.CallSaveTransactionAPI(reqSaveTranArr[0], function (respTransaction) {
                      if (respTransaction.STATUS == "SUCCESS") {
                        for (var resp = 0; resp < fileNames.length; resp++) {
                          var transactionDetail = {};
                          transactionDetail.FileName = fileNames[resp];
                          transactionDetail.SaveTranResult = respTransaction;
                          transactionDetail.SaveTranResult.STATUS = "SUCCESS";
                          tranDetArr.push(transactionDetail);
                        }
                        var obj = {};
                        obj["SAVED_TRANSACTIONS"] = tranDetArr;
                        obj["SaveTranResult"] = respTransaction;
                        obj["ERRONEOUS_DATA"] = errorDataArr;
                        //console.log("tranDetArr" + JSON.stringify(obj))
                        callBackExchangeEngine(obj);
                      } else {
                        var objExLogsInsert = {};
                        objExLogsInsert.CREATED_BY = objLogInfo.USER_ID;
                        objExLogsInsert.FILE_NAME = fileName;
                        objExLogsInsert.LOG_MESSAGE = 'File Import Process Failed';
                        objExLogsInsert.STATUS = 'IMPORT_FAILED';
                        objExLogsInsert.LOG_TYPE = 'ERROR';
                        objExLogsInsert.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                        reqTranDBInstance.InsertTranDBWithAudit(originalRequest.tran_db_instance, 'EX_LOGS', [objExLogsInsert], objLogInfo, function (result, error) {
                          if (error) {
                            reqInstanceHelper.PrintInfo(serviceName, "Error While Inserting Failed Import Data in EX_LOGS Table...", objLogInfo);
                          } else {
                            reqInstanceHelper.PrintInfo(serviceName, "Successfully Inserted Failed Import Data in EX_LOGS Table...", objLogInfo);
                          }
                          resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120030', 'Error Fetching Dt Info', '', '', '');
                          callBackExchangeEngine(resObj);
                        });
                      }
                    });
                  } else {
                    var errDataObj = {};
                    errDataObj["FILE_NAME"] = fileName;
                    errDataObj["FAILED_VALIDATIONS"] = dtValidation.VALIDATED_DATA;
                    errorDataArr.push(errDataObj);
                    callBackExchangeEngine(errorDataArr);
                  }
                })
              })
            })

          } else {
            resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120031', 'Error Fetching Dt Info', '', '', '');
            callBackExchangeEngine(resObj);
          }
        })
      }
    } catch (err) {
      resObj = commonFile.prepareMethodResponse('FAILURE', '', '', 'ERR-EXG-120029', 'Exception occured during import', err, '', '');
      callBackExchangeEngine(resObj);
    }
  } else {
    // not implemented
  }
}





function updateStatusInfo(inputData) {
  return new Promise((resolve, reject) => {
    var dt_info = inputData.DT_INFO;
  })
}

function getProcessedDataFromCustomCode(reqObj, ffg_json, callBackProcessedData) {
  var resObj = ""
  var resultData = {
    "PROCESSED_DATA": "",
    "PROJECT_CODE": ""
  };
  try {
    var fileFormatGroupObj = {};

    // currently only one file format
    var project_name = ffg_json.FILE_FORMATS[0]["PROJECT_NAME"] || ffg_json.FILE_FORMATS[0]["project_name"] || "";
    var type = ffg_json.FILE_FORMATS[0]["TYPE"] || ffg_json.FILE_FORMATS[0]["type"] || "";
    var project_code = ffg_json.FILE_FORMATS[0]["PROJECT_CODE"] || ffg_json.FILE_FORMATS[0]["project_code"] || "";

    if (project_name != "" && type != "D") {

      var objCC = require('../../ide_services/' + project_name + '/' + 'preImportDataProcessing' + ".js");
      objCC["preImportDataProcessing"](reqObj.tempSelectedData, function (callbackCC) {
        var preparedData = callbackCC;
        resultData["PROCESSED_DATA"] = callbackCC;
        resultData["PROJECT_CODE"] = project_code;
        resultData["PROJECT_NAME"] = project_name;

        resObj = commonFile.prepareMethodResponse("SUCCESS", "", resultData, "", "", "", "", "");
        return callBackProcessedData(resObj);
      })
    } else {
      resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120011", "Error while executing getProcessedDataFromCustomCode method", "", "", "");
      return callBackProcessedData(resObj);
    }

  } catch (error) {
    console.log("error", error)
    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120012", "Exception while executing getProcessedDataFromCustomCode method", error, "", "");
    callBackProcessedData(resObj)
  }
}

function escapeSpecialChars(jsonString) {

  return jsonString
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f")
    .replace(/\\/g, "\\");

}

function getDTDTTInfo(app_id, dt_code, dtt_code, dep_cas_instance, objLogInfo, callback) {
  var resObj = {};


  async.series([
    function (asyncSeries) {
      asyncSeries();
    },
    function (asyncSeries) {
      if (dtt_code != "" && dtt_code != undefined) {
        reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'dtt_info', [], {
          'dtt_code': dtt_code,
          'app_id': app_id
        }, objLogInfo, function (error, result) {
          if (error) {
            resObj.STATUS = "FAILURE";
            resObj.DATA = error;
          } else {
            resObj.STATUS = "SUCCESS";
            resObj.DATA = result.rows;
          }
          asyncSeries();
        });
      } else {
        asyncSeries();
      }
    },
  ], function (err) {
    callback(resObj)
  })

}


function module_exists(name) {
  try {
    return require.resolve(name)
  } catch (e) {
    return false
  }
}


function customValidationPreparation(dep_cs_instance, customValidationDetail, itemsDet, callback) {
  var totalStatus = true;

  var items = [];
  for (var i = 0; i < itemsDet.length; i++) {
    for (var j = 0; j < customValidationDetail.length; j++) {
      var temp = "";
      temp = JSON.parse(JSON.stringify(customValidationDetail[j]));
      var obj = {};
      obj = temp;
      obj["VALUE"] = itemsDet[i][temp["value_field"]]
      obj["ROW_COUNT"] = i;
      obj["COLUMN"] = temp["disp_field"];
      obj["VALIDATION"] = "Custom Validation Failed"
      obj["PROJECT_NAME"] = temp["cus_val_project_name"];
      obj["PROJECT_PATH"] = temp["cus_val_project_info"]["DesPath"];
      items.push(obj);
    }
  }
  async.forEachOf(items, function (value, key, callbackAsync) {
    var res = true;
    console.log(__dirname);
    var projectName = value["PROJECT_NAME"];
    var projectPath = value["PROJECT_PATH"];

    try {
      if (module_exists(projectPath + "/" + projectName + "/validateData.js") != false) {
        delete require.cache[require.resolve(projectPath + "/" + projectName + "/validateData.js")]
      }
      var instance = require(require.resolve(projectPath + "/" + projectName + "/validateData.js"));
      if (instance != undefined && instance != "") {
        instance['validateData'](value, function (resp) {
          var callbackCC = resp; // true-validation passed
          var message = "SUCCESS";
          if (!callbackCC) {
            message = "FAILURE"
          }

          items[key]["VALIDATION_STATUS"] = message;
          if (callbackCC != undefined) {
            return callbackAsync();
          }
        });
      } else {
        return callbackAsync();
      }
    } catch (ex) {
      res = true;
      items[key]["VALIDATION_STATUS"] = "SUCCESS";
    }
  }, function (err) {
    return callback(items)
  })
}

function validateDtData(items, dtDetail, fieldArr, Need_DTT_Validation) {
  if (Need_DTT_Validation == 'true') {
    var totalStatus = true;

    var dtData = [];
    var customValidationArr = [];

    var dataFormat = dtDetail["DATA_FORMATS"];

    for (var i = 0; i < dataFormat.length; i++) {
      for (var j = 0; j < dataFormat[i]["DF_DETAILS"].length; j++) {
        dtData.push(dataFormat[i]["DF_DETAILS"][j]);
      }
    }
    dtDetail = dtData;
    var dtDetails = [];
    for (var k = 0; k < fieldArr.length; k++) {
      for (var j = 0; j < dtDetail.length; j++) {
        if (dtDetail[j]["TARGET_COLUMN"].toLowerCase() == fieldArr[k]["value_field"].toLowerCase()) {
          dtDetails.push(dtDetail[j]);
          break;
        }
      }

    }
    var validateRecordArr = [];
    for (var i = 0; i < items.length; i++) {
      if (Object.keys(items[i]).length != 0) {
        var validateRecordObj = {};
        validateRecordObj["__VALIDATION__STATUS__"] = [];

        for (var j = 0; j < dtDetails.length; j++) {
          for (var k = 0; k < fieldArr.length; k++) {

            if (fieldArr[k]["value_field"] != undefined) {

              if (dtDetails[j]["TARGET_COLUMN"].toLowerCase() == fieldArr[k]["value_field"].toLowerCase()) {
                var item = items[i][fieldArr[k]["value_field"]] || "";
                var itemStatus = "";

                if (dtDetails[j]["ALLOW_NULL"] == "N") {
                  if (item == null || item == "") {
                    var obj = {};
                    obj["ROW_COUNT"] = i;
                    obj["COLUMN"] = fieldArr[k]["disp_field"];
                    obj["VALUE"] = item || "";
                    obj["VALIDATION"] = "Field Should not be NULL";
                    validateRecordArr.push(obj);
                    totalStatus = false;
                  }
                }

                if (fieldArr[k]["length"] != "") {
                  if (item.length > parseInt(fieldArr[k])) {
                    var obj = {};
                    obj["ROW_COUNT"] = i;
                    obj["COLUMN"] = fieldArr[k]["disp_field"];
                    obj["VALUE"] = item || "";
                    obj["VALIDATION"] = "Value length validation failed";
                    validateRecordArr.push(obj);
                    totalStatus = false;
                  }
                }

                if (fieldArr[k]["ctrltype"] == "DATETIME") {

                  if (new Date(item).toString() == "Invalid Date") {
                    var obj = {};
                    obj["ROW_COUNT"] = i;
                    obj["COLUMN"] = fieldArr[k]["disp_field"];
                    obj["VALUE"] = item || "";
                    obj["VALIDATION"] = "Improper Date Value";
                    validateRecordArr.push(obj);
                    totalStatus = false;
                  }
                }

                if (Need_DTT_Validation) {
                  var df_ui = dtDetails[j]["DF_UI"]["VALIDATION_BEHAVIOR"] || "";

                  if (df_ui != "" && df_ui.length > 0) {
                    if (item == undefined) {
                      item = "";
                    }
                    itemStatus = dataValidation(item, df_ui);
                  }

                  if (itemStatus != undefined && itemStatus != "") {
                    if (itemStatus.STATUS == "FAILURE") {
                      if (itemStatus.MESSAGE.length > 0) {
                        for (var z = 0; z < itemStatus.MESSAGE.length; z++) {
                          var obj = {};
                          obj["ROW_COUNT"] = i;
                          obj["COLUMN"] = fieldArr[k]["disp_field"];
                          obj["VALUE"] = item || "";
                          obj["VALIDATION"] = itemStatus.MESSAGE[z];
                          validateRecordArr.push(obj);
                          totalStatus = false;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    var obj = {};
    obj["STATUS"] = (totalStatus) ? "SUCCESS" : "FAILURE";
    obj["VALIDATED_DATA"] = validateRecordArr;
    return obj;

  } else {
    var obj = {};
    obj["STATUS"] = "SUCCESS"
    obj["VALIDATED_DATA"] = [];
    return obj;
  }

}



function notEmptyValidation(data, dtDetails) {
  var res = false;
  var referenceValue = dtDetails["REFERENCE_VALUE"] || ""

  if (data != "" && data != undefined) {
    if (referenceValue == "NOTZERO") {
      if (!isNaN(parseInt(data))) {
        if (parseInt(data) > 0) {
          res = true;
        }
      } else {
        res = true;
      }
    } else {
      res = true;
    }
  }

  return res;
}

function isInteger(x) {
  return typeof x === "number" && isFinite(x) && Math.floor(x) === x;
}

function isFloat(x) {
  if (x != undefined && x != "") {
    if (x.toString().indexOf(".") !== -1 && parseFloat(x) != NaN) {
      return true;
    }
  }
  return false;
}

function regexValidation(data, regexExpression) {
  var res = false;

  regexExpression = regexExpression.replace('/', '').replace('/', '').replace('\\\\', '\\');
  var regexp = new RegExp(regexExpression);
  if (data != "" && data != undefined) {

    if (isInteger(data)) {
      data = parseInt(data);
    }

    if (isFloat(data)) {
      data = parseFloat(data);
    }

    res = regexp.test(data);
  }

  if (res == "") {
    res = false;
  }

  return res;
}

function rangeValidation(data, from, to) {
  var res = false;
  if (!isNaN(data)) {
    if ((parseInt(data) >= parseInt(from)) && (parseInt(data) <= parseInt(to))) {
      res = true;
    }
  }

  return res;
}

function lengthValidation(inpdata, minlength, maxlength) {
  var res = false;
  if (inpdata == undefined) {
    inpdata = "";
  }

  var data = inpdata.toString();
  if (data != undefined && data != "") {
    if (data.length >= minlength && data.length <= maxlength) {
      res = true;
    }
  }

  return res;
}

function customValidation(data, projectCode) {
  var res = true;
  try {
    var instance = require(refPath + 'ide/' + projectCode + projectCode + ".js");
    if (instance != undefined && instance != "") {
      var callbackCC = instance['validateData'](data);
      if (callbackCC != undefined && callbackCC == "SUCCESS") {
        res = true;
      } else {
        res = false;
      }
    }
  } catch (ex) {
    res = true;
  }
  return res;
}

function previousDateValidation(data) {
  var res = false;
  if (new Date(data) instanceof Date) {
    if (new Date(data).getTime() >= new Date().getTime()) {
      res = true;
    }
  }

  return res;
}

function futureDateValidation(data) {
  var res = false;
  if (new Date(data) instanceof Date) {
    if (new Date(data).getTime() <= new Date().getTime()) {
      res = true;
    }
  }

  return res;
}




function dataValidation(data, dtDetails) {


  var obj = {};
  obj["STATUS"] = "SUCCESS";
  obj["MESSAGE"] = [];


  for (var i = 0; i < dtDetails.length; i++) {

    var res = true;
    var dtDetail = dtDetails[i];
    var valMessage = "";
    var cusValMessage = "";

    console.log("TYPE " + dtDetail["TYPE"]);

    switch (dtDetail["TYPE"]) {
      case "RFV":
        res = notEmptyValidation(data, dtDetail);
        break;
      case "FV":
        res = regexValidation(data, dtDetail["FORMAT"]);
        break;
      case "RV":
        res = rangeValidation(data, dtDetail["FROM_VALUE"], dtDetail["TO_VALUE"]);
        break;
      case "LV":
        res = lengthValidation(data, dtDetail["MIN_LENGTH"], dtDetail["MAX_LENGTH"]);
        break;
      case "CV":
        break;
      case "FDV":
        res = futureDateValidation(data);
        break;
      case "PDV":
        res = previousDateValidation(data);
        break;
      default:
        break;
    }


    if (res == false) {

      valMessage = (dtDetail["VAL_MESSAGE"] != "") ? dtDetail["VAL_MESSAGE"] : dtDetail["CUSTOM_VAL_MESSAGES"];

      if (dtDetail["TYPE"] != 'CV') {
        obj["MESSAGE"].push(valMessage);
      }
    }
  }

  if (obj["MESSAGE"].length > 0) {
    obj["STATUS"] = "FAILURE";
  }

  return obj;

}

function getMaxCount(recordFormat) {
  var maxcount = ''
  for (var i in recordFormat) {
    if (recordFormat[i]['Record_Format_Type'] === 'DETAIL') {
      maxcount = recordFormat[i]['Maximum_Count'] || ''
      break
    }
  }

  return maxcount
}

function importProcess(ruleObj, callbackMain) { }

function importFromStoragePath(source, callbackStoragePathImport) {
  var filesToImport = []
  var importFolderName = ''
  // Extract zip file
  var readStream = fs.createReadStream(source.config.path + source.compression.original_file_name + source.compression.format)
  var writeStream = fstream.Writer(source.config.path)

  readStream
    .pipe(unzip.Parse())
    .pipe(writeStream)

  // Need to check path details
  if (source.compression.is_compressed === 'Y') {
    importFolderName = source.config.path + source.compression.original_file_name
  } else {
    importFolderName = source.config.path
  }

  var zipFileMethodStart = ''
  zipFileMethodEnd = ''
  zipFileMethod = ''

  var filesArr = []
  fs.readdir(importFolderName, (err, files) => {
    files.forEach(file => {
      filesArr.push(importFolderName + file)
    })
    callbackStoragePathImport(filesArr)
  })
}

function exportToStoragePath(source, destination, files, callBackExportToStoragepath) {
  var exportFolderName = destination.config.path
  async.forEachOf(obj, function (value, key, callback) {
    fs.readFile(value, 'utf8', (err, data) => {
      fs.writeFile(destination.path, data, function (err) {
        if (err) {
          console.log('Write File Error ' + err)
        }
      })
    })
  }, function (err) {
    if (err) {
      callBackExportToStoragepath('FAILURE')
    } else {
      callBackExportToStoragepath('SUCCESS')
    }
  })
}

function processFileFormat(fileFormat, originalRequest) {
  return new Promise((resolve, reject) => {
    var session = originalRequest.SESSION;
    // Get Filename pattern and file extension
    var fileNamePattern = fileFormat['FILE_NAME_PATTERN']
    var fileExtension = fileFormat['EXTENSION']
    // Form File name alogn with extension from file pattern
    var fileName = formulateFileNames(fileNamePattern, session) + fileExtension

    console.log(fileName)
    executeSequenceFormat(originalRequest, fileName, fileFormat, session).then((response) => {
      fileName = fileName.replace('$DAILY_SEQUENCE', response);
      fileName = fileName.replace('$WEEKLY_SEQUENCE', response);
      fileName = fileName.replace('$MONTHLY_SEQUENCE', response);
      fileName = fileName.replace('$YEARLY_SEQUENCE', response);
      // fileName = fileName.replace(/(\$DAILY_SEQUENCE.*?\$)/, response)
      fileFormat['FILE_NAME'] = fileName;
      resolve(fileFormat);
    }).catch((error) => {
      fileFormat['FILE_NAME'] = fileName;
      resolve(fileFormat);
    })
  })
}


function executeSequenceFormat(originalRequest, fileName, format, session) {
  return new Promise((resolve, reject) => {
    var exffg_code = format.EXFFG_CODE
    var app_id = session.APP_ID
    var dep_cas_instance = originalRequest.dep_cas_instance;

    var sequence_type = "";
    var sequence_val = "";
    var last_date = "";
    var isNewSequence = false;
    async.series([

      function (asyncCallback) {
        if (fileName.includes("$DAILY_SEQUENCE")) {
          sequence_type = "DAILY"
        }

        if (fileName.includes("$WEEKLY_SEQUENCE")) {
          sequence_type = "WEEKLY"
        }

        if (fileName.includes("$MONTHLY_SEQUENCE")) {
          sequence_type = "MONTHLY"
        }

        if (fileName.includes("$YEARLY_SEQUENCE")) {
          sequence_type = "YEARLY"
        }
        console.log(sequence_type, 'sequence_type')
        asyncCallback();


      },
      function (asyncCallback) {
        if (fileName == "") {
          return resolve(fileName);
        } else {
          reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_file_format_sequence', [], {
            'exffg_code': exffg_code,
            'app_id': app_id
          }, originalRequest.objLogInfo, function (error, result) {
            if (error) {
              reject(error);
            } else {
              if (result.rows.length > 0) {
                var response = result.rows[0];
                sequence_val = response['file_seq_no'];
                last_date = response["sequence_date"];
                isNewSequence = false;
                asyncCallback();
              } else {
                sequence_val = "";
                isNewSequence = true;
                asyncCallback();
              }
            }
          })
        }

      },
      function (asyncCallback) {
        var formedSequenceValueObj = "";

        switch (sequence_type) {
          case "DAILY":
            formedSequenceValueObj = getNextSequence(sequence_val, last_date, fileName, "isToday");
            break;
          case "WEEKLY":
            formedSequenceValueObj = getNextSequence(sequence_val, last_date, fileName, "isThisWeek");
            break;
          case "MONTHLY":
            formedSequenceValueObj = getNextSequence(sequence_val, last_date, fileName, "isThisMonth");
            break;
          case "YEARLY":
            formedSequenceValueObj = getNextSequence(sequence_val, last_date, fileName, "isThisYear");
            break;
        }

        if (formedSequenceValueObj != "") {
          if (isNewSequence) {
            reqFXDBInstance.InsertFXDB(dep_cas_instance, 'ex_file_format_sequence', [{
              "sequence_date": formedSequenceValueObj.last_date,
              "file_seq_no": formedSequenceValueObj.formedSequence,
              'exffg_code': exffg_code,
              'app_id': app_id
            }], originalRequest.objLogInfo, function (pErr) {
              if (pErr) {
                reject(pErr)
              } else {
                return resolve(formedSequenceValueObj.formedSequence);
              }
            });
          } else {
            reqFXDBInstance.UpdateFXDB(dep_cas_instance, 'ex_file_format_sequence', {
              "sequence_date": formedSequenceValueObj.last_date,
              "file_seq_no": formedSequenceValueObj.formedSequence
            }, {
              'exffg_code': exffg_code,
              'app_id': app_id
            }, originalRequest.objLogInfo, function (pErr, resData) {
              if (pErr) {
                reject(pErr)
              } else {
                return resolve(formedSequenceValueObj.formedSequence);
              }
            })
          }
        } else {
          reject("")
        }
      }
    ])
  })
}


function getDigitCount(format) {
  try {
    return format.split("~")[1].substring(7, 8);

  } catch (error) {
    return 1;
  }
}

const isToday = (someDate) => {
  const today = new Date()
  return someDate.getDate() == today.getDate() &&
    someDate.getMonth() == today.getMonth() &&
    someDate.getFullYear() == today.getFullYear()
}

const isThisWeek = (provideddate) => {
  var today = new Date()

  if (provideddate.getWeek() === todat.getWeek()) {
    return true;
  }

  return false;

}

const isThisMonth = (provideddate) => {
  var today = new Date()

  if ((provideddate.getMonth() + 1) === (today.getMonth() + 1)) {
    return true;
  }

  return false;
}

const isThisYear = (provideddate) => {
  var provideddate = new Date(provideddate);
  var today = new Date()

  if (provideddate.getFullYear() === today.getFullYear()) {
    return true;
  }

  return false;
}

Date.prototype.getWeek = function () {
  var onejan = new Date(this.getFullYear(), 0, 1);
  var today = new Date(this.getFullYear(), this.getMonth(), this.getDate());
  var dayOfYear = ((today - onejan + 86400000) / 86400000);
  return Math.ceil(dayOfYear / 7)
};


function getNextSequence(sequence_val, last_date, format, execfn) {

  formatVal = getDigitCount(format);
  var formedSequence = "";

  if (last_date == "") {
    last_date = reqDateFormatter.GetTenantCurrentDateTime(headers, '');


    try {
      formatVal = parseInt(formatVal);

      for (var i = 0; i < formatVal; i++) {
        formedSequence += "0";
      }
    } catch (ex) {
      return "";
    }


  } else {
    if (eval(execfn + '(new Date(last_date))')) {
      formedSequence = parseInt(sequence_val) + 1;
    } else {

      for (var i = 0; i < formatVal; i++) {
        formedSequence += "0";
      }
      last_date = reqDateFormatter.GetTenantCurrentDateTime(headers, '');
    }
  }

  if (formedSequence.toString().length !== parseInt(formatVal)) {
    var tempForm = "";
    for (var i = 0; i < (parseInt(formatVal) - formedSequence.toString().length); i++) {
      tempForm += "0"
    }

    formedSequence = tempForm + formedSequence;
  }

  return {
    "last_date": last_date,
    "formedSequence": formedSequence
  }
}

function processRecordFormats(recordFormats, selectedDataArr, recordFormatSeparator, customSeparatorRF) {
  // response object for mainitaing common structure
  customSeparatorRF = formulateSeparator(recordFormatSeparator, customSeparatorRF)
  var resObj = {
    'HEADER': [],
    'SUBHEADER': [],
    'DETAIL': [],
    'FOOTER': [],
    'SUBFOOTER': [],
    'SEPARATOR': customSeparatorRF
  }
  var resArr = []

  // loop through record formats
  for (var index_record_format = 0; index_record_format < recordFormats.length; index_record_format++) {
    var recordFormat = recordFormats[index_record_format]
    // describes the type of format ex header,footer etc...
    var recordFormatType = recordFormat['Record_Format_Type']
    var fieldFormatSeparator = recordFormat['seperator']
    var customSeparator = recordFormat['CUSTOM_SEPERATOR'] || recordFormat['custom_seperator'] || ''
    // process field formats of the corresponding record format
    resArr = processFieldFormats(recordFormat['FIELD_FORMATS'], selectedDataArr, fieldFormatSeparator, customSeparator)
    // store the record format data inside corresponding key result
    resObj[recordFormatType] = resArr
  }

  return resObj
}

function isDate(data) {
  try {
    var a = new Date(data);
    if (a.getTime() != "") {
      return true;
    } else {
      return false;
    }
  } catch (ex) {
    return false;
  }
}

function processFieldFormats(fieldFormats, selectedDataArr, fieldFormatSeparator, customSeparator) {
  var resArr = []

  // loop through data ex:data from wfselect
  for (var index_data = 0; index_data < selectedDataArr.length; index_data++) {
    var selectedDataObj = selectedDataArr[index_data]

    // loop through fieldFormat 
    var resObj = {}
    for (var index_field_formats = 0; index_field_formats < fieldFormats.length; index_field_formats++) {
      var fieldFormat = fieldFormats[index_field_formats]

      var fieldFormatType = fieldFormat['Field_Format_Type']
      var prefix = fieldFormat['Preffix'] // spelling need to be changed
      var suffix = fieldFormat['Suffix']
      var value_field = fieldFormat['value_field'].toLowerCase()
      // Note: currently for checking purpose we have avoided tab space separator
      // need to be done in this version itself
      var separator = formulateSeparator(fieldFormatSeparator, customSeparator)

      var format = fieldFormat['FORMAT'] || fieldFormat['format'] || '';


      if (format != '') {

        try {
          format = JSON.parse(format.replace("date:", ""))
        } catch (ex) {

        }


        if (isDate(selectedDataObj[value_field])) {
          try {
            format = format.split("d").join("D")
            format = format.split("y").join("Y")
            format = format.split("m").join("M")
            var temp = momentInstance(selectedDataObj[value_field]).format(format)
            selectedDataObj[value_field] = temp;
          } catch (ex) {
            console.log(ex)
          }
        }
      }

      var data = ''
      var display_field = ""
      if (fieldFormatType === 'S') {
        data = fieldFormat["disp_field"]
      } else {
        data = selectedDataObj[value_field]
      }
      if (fieldFormatType === 'S') {
        display_field = fieldFormat["value_field"]
      } else {
        display_field = (fieldFormat["disp_field"] != '' && fieldFormat["disp_field"] != undefined) ? fieldFormat["disp_field"] : value_field
      }
      // appended between two records
      var length = fieldFormat['length']
      var fillers = fieldFormat['fillers']
      var padposition = fieldFormat['padding'];
      var ctrlType = fieldFormat['ctrltype'];
      var data = prepareData(data, prefix, suffix, separator, length, fillers, padposition, ctrlType)
      if (data == undefined || data == null) {
        data = "";
      }
      resObj[display_field] = data;
    }
    resArr.push(resObj)
  }
  return resArr;
}

function formulateSeparator(separator, custom_separator) {
  switch (separator) {
    case 'VBCRLF':
      return '\r\n'
    case 'VBTAB':
      return '\t'
    case 'vbcrlf':
      return '\r\n'
    case 'vbtab':
      return '\t'
    case 'others':
      return custom_separator
    default:
      return separator
  }
}


function replaceAllOccurance(text, replacementText, toReplace) {
  text = text.split(replacementText).join(toReplace);
  return text;
}

function prepareData(originalData, prefixval, suffixval, separator, totalLength, fillers, padding, ctrlType) {
  try {

    fillers = replaceAllOccurance(fillers, "$SPACE$", ' ');
    prefixval = replaceAllOccurance(prefixval, "$SPACE$", ' ');
    suffixval = replaceAllOccurance(suffixval, "$SPACE$", ' ');

    if (ctrlType == "DATETIME") {
      if (originalData == "" || originalData == null) {
        originalData = "";
      } else {
        originalData = reqDateFormatter.ConvertDate(originalData.toLowerCase(), headers);
      }
    }

    if (originalData == '' || originalData == null || originalData == undefined) {
      originalData = ''
    }


    if (totalLength !== '') {

      var totalDatalength = prefixval + originalData + suffixval
      var nonAvoidableLength = getVarCount(prefixval) + getVarCount(suffixval)
      var applicableDataLength = totalLength - nonAvoidableLength
      var originalDataLength = getVarCount(originalData)
      var avoidableDataLength = totalLength - nonAvoidableLength
      var sliceCount = 0
      var padcount = 0

      if (originalDataLength > avoidableDataLength) {
        // slice the original data
        if (avoidableDataLength !== 0 && avoidableDataLength !== '' && avoidableDataLength !== '0') {
          sliceCount = (originalDataLength - avoidableDataLength)
          originalData = originalData.slice(0, -sliceCount)
        }
      } else {
        // add fillers
        padcount = (avoidableDataLength - originalDataLength)
        var paddedVal = ''
        for (var i = 0; i < padcount; i++) {
          paddedVal += fillers
        }

        if (padding === 'PADLEFT') {
          originalData = paddedVal + originalData
        } else {
          originalData = originalData + paddedVal
        }
      }
    }

    if (prefixval == undefined) {
      prefixval = ''
    }

    if (suffixval == undefined) {
      suffixval = ''
    }

    originalData = prefixval + originalData + suffixval


    if (originalData == '' || originalData == null || originalData == undefined) {
      originalData = ''
    }

    return originalData + separator
    // }
  } catch (ex) {
    return "";
  }
}

function getVarCount(data) {
  if (data == undefined || data == '' || data == null) {
    data = 0
  } else {
    data = data.length
  }
  return data
}

function isInt(value) {
  return !isNaN(value) &&
    parseInt(Number(value)) == value &&
    !isNaN(parseInt(value, 10))
}

/**
 * 
 * @param fileNamePattern - Pattern defined in FILE_FORMATS array
 */
function formulateFileNames(fileNamePattern, session) {
  fileNamePattern = replaceText(fileNamePattern, '$DATE$', momentInstance().format('DDMMYYYY'))
  fileNamePattern = replaceText(fileNamePattern, '$date$', momentInstance().format('DDMMYYYY'))
  fileNamePattern = replaceText(fileNamePattern, '$D$', momentInstance().format('D'))
  fileNamePattern = replaceText(fileNamePattern, '$Y2$', momentInstance().format('YY'))
  fileNamePattern = replaceText(fileNamePattern, '$Y4$', momentInstance().format('YYYY'))
  fileNamePattern = replaceText(fileNamePattern, '$DM$', momentInstance().format('MM'))
  fileNamePattern = replaceText(fileNamePattern, '$H12$', momentInstance().format('hh'))
  fileNamePattern = replaceText(fileNamePattern, '$H24$', momentInstance().format('HH'))
  fileNamePattern = replaceText(fileNamePattern, '$TM$', momentInstance().format('mm'))
  fileNamePattern = replaceText(fileNamePattern, '$MS$', momentInstance().milliseconds())
  fileNamePattern = replaceText(fileNamePattern, '$S$', momentInstance().format('ss'))
  fileNamePattern = replaceText(fileNamePattern, '$TIME$', momentInstance().format('hhmmss'))
  fileNamePattern = replaceText(fileNamePattern, '$time$', momentInstance().format('hhmmss'))

  fileNamePattern = replaceText(fileNamePattern, '$DDMMYYYY$', momentInstance().format('ddMMyyyy'))
  fileNamePattern = replaceAllOccurance(fileNamePattern, "$SPACE$", " ");

  if (session != undefined) {
    fileNamePattern = replaceText(fileNamePattern, '$SYSTEM_ID$', session.SYSTEM_ID)
  }

  return fileNamePattern
}



function CallCodeSnippetByFFGCode(params, CallCodeSnippetByFFGCodeCB) {
  try {
    /*  params contains
         - FFG_JSON
         - EXFFG_CODE
         - dep_cas_instance
         - objLogInfo
         - APP_ID
         - CLIENT_ID
         - EXG_PROCESS_NAME 
         - CODE_SNIPPET_INPUT_PARAMS
         
         
        Code Snippet Input Params
        For File CREATE Process
        ---------------------------
        - SETUP
        - headers
        - TranDB
        - PRCT_ID
        - session_info
        - objLogInfo
        - PROCESSED_DATA
        
        For File UPLOAD Process
        ---------------------------
        - SUCCESS_FILE_LIST
        - FAILED_FILE_LIST
        - PRCT_ID
        - SESSION_INFO
        - TRAN_DB_INSTANCE
        - CLT_CAS_INSTANCE
        - DEP_CAS_INSTANCE
        
        
        For File DOWNLOAD Process
        ---------------------------
        - SUCCESS_FILE_LIST
        - FAILED_FILE_LIST
        - PRCT_ID
        - SESSION_INFO
        - TRAN_DB_INSTANCE
        - CLT_CAS_INSTANCE
        - DEP_CAS_INSTANCE
        
        For File UPDATE [Import] Process
        ---------------------------
        - ffg_json
        - files
        - originalUrl
        - default_params
        - headers
        - TranDB
        - PRCT_ID
        - session_info
        - file_info
        - gateway_setup
        - objLogInfo
        - continue_process
        */
    var info = '';
    var EXFFG_CODE = params.EXFFG_CODE;
    var exgProcessName = params.EXG_PROCESS_NAME;
    var codeSnippetInputParams = params.CODE_SNIPPET_INPUT_PARAMS;
    var objLogInfo = params.objLogInfo;
    reqInstanceHelper.PrintInfo(serviceName, 'Check and Getting the FFG Json', objLogInfo);
    CheckAndGetFFGJson(params, function name(FFG_JSON, error) {
      if (error) {
        CallCodeSnippetByFFGCodeCB(null, error);
      } else {
        reqInstanceHelper.PrintInfo(serviceName, 'Got FFG JSON - ' + JSON.stringify(FFG_JSON), objLogInfo);
        var fileFormats = FFG_JSON.FILE_FORMATS[0] || {};
        var customCodeSnippets = fileFormats.PROJECTS || [];
        var codeSnippetProjectName = '';
        var codeSnippetFunctionName = '';
        var containsProjectName = '';
        // Getting Code Snippet Name - New Case
        console.log(exgProcessName, 'exgProcessName');
        for (var u = 0; u < customCodeSnippets.length; u++) {
          var codesnippetInfo = customCodeSnippets[u];
          console.log(codesnippetInfo.PROJECT_CASE, 'codesnippetInfo.PROJECT_CASE');
          console.log(codesnippetInfo.PROJECT_CASE.includes(exgProcessName), 'Includes expression');
          if (codesnippetInfo.PROJECT_NAME) {
            containsProjectName = codesnippetInfo.PROJECT_NAME;
          }
          if (codesnippetInfo.PROJECT_CASE.includes(exgProcessName)) {
            if (codesnippetInfo.PROJECT_NAME) {
              codeSnippetProjectName = codesnippetInfo.PROJECT_NAME;
            }
            break;
          }
        }
        console.log(containsProjectName, ' - containsProjectName');
        // Getting Code Snippet Name -  Old Case [Download Compatiblity]
        if (fileFormats.PROJECT_NAME && !containsProjectName) {
          codeSnippetProjectName = fileFormats.PROJECT_NAME;
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Code Snippet Name for - ' + codeSnippetProjectName + ' Process is ' + codeSnippetProjectName, objLogInfo);
        if (codeSnippetProjectName && exgProcessName) {
          if (exgProcessName.toUpperCase() == 'CREATE') {
            codeSnippetFunctionName = 'writeData';
          } else if (exgProcessName.toUpperCase() == 'DOWNLOAD') {
            codeSnippetFunctionName = 'downloaExtension';
          } else if (exgProcessName.toUpperCase() == 'UPDATE') {
            codeSnippetFunctionName = 'importToDB';
          } else if (exgProcessName.toUpperCase() == 'UPLOAD') {
            codeSnippetFunctionName = 'uploadExtension';
          }
          var codeSnippetPath = '../../ide_services/' + codeSnippetProjectName + '/' + codeSnippetFunctionName + '.js';
          reqInstanceHelper.PrintInfo(serviceName, 'Getting Code Snippet from this Path - ' + codeSnippetPath, objLogInfo);
          try {
            delete require.cache[require.resolve(codeSnippetPath)]
            var codeSnippetFunctionDefinition = require(codeSnippetPath);
            reqInstanceHelper.PrintInfo(serviceName, 'Calling Code Snippet Project....', objLogInfo);
            codeSnippetFunctionDefinition[codeSnippetFunctionName](codeSnippetInputParams, function (codeSnippetCallback) {
              reqInstanceHelper.PrintInfo(serviceName, 'Code Snippet Response - ' + JSON.stringify(codeSnippetCallback), objLogInfo);
              CallCodeSnippetByFFGCodeCB(codeSnippetCallback, null);
            });
          } catch (error) {
            info = 'Error While Calling Code Snippet Project From Exchange Service... Error - ' + error;
            reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
            CallCodeSnippetByFFGCodeCB(null, info);
          }
        } else {
          info = 'There is No Code Snippet Project Name Found From FFG JSon...';
          reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
          reqInstanceHelper.PrintInfo(serviceName, 'Skipping the Code Snippet Calling Process...', objLogInfo);
          reqInstanceHelper.PrintInfo(serviceName, 'Exchange Process Name - ' + exgProcessName + ' and Code Snippet Project Name - ' + codeSnippetProjectName, objLogInfo);
          CallCodeSnippetByFFGCodeCB(null, null);
        }
      }
    });
  } catch (error) {
    var info = 'Catch error in CallCodeSnipetByFFGCode() Error - ' + error;
    reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
    CallCodeSnippetByFFGCodeCB(null, info);
  }
}

function CheckAndGetFFGJson(reqObj, CheckAndGetFFGJsonCB) {
  /*  reqObj contains
  - FFG_JSON
  - EXFFG_CODE
  - APP_ID
  - CLIENT_ID
  - dep_cas_instance
  - objLogInfo */
  try {
    var objLogInfo = reqObj.objLogInfo;
    var EXFFG_CODE = reqObj.EXFFG_CODE;
    var APP_ID = reqObj.APP_ID;
    var CLIENT_ID = reqObj.CLIENT_ID;
    var FFG_JSON = reqObj.FFG_JSON;
    if (FFG_JSON) {
      CheckAndGetFFGJsonCB(FFG_JSON, null);
    } else {
      if (EXFFG_CODE && CLIENT_ID && APP_ID) {
        reqInstanceHelper.PrintInfo(serviceName, 'Available EXFFG_CODE - ' + EXFFG_CODE, objLogInfo);
        var objRequest = {};
        objRequest.dep_cas_instance = reqObj.dep_cas_instance;
        objRequest.EXFFG_CODE = reqObj.EXFFG_CODE;
        objRequest.session = {};
        objRequest.session.APP_ID = APP_ID;
        objRequest.session.CLIENT_ID = CLIENT_ID;
        objRequest.objLogInfo = reqObj.objLogInfo;
        reqExchangeHelper.getExchangeFileFormatGroups(objRequest, function (FFGroupInfo) {
          if (FFGroupInfo.STATUS !== "SUCCESS") {
            reqInstanceHelper.PrintInfo(serviceName, 'Error While Querying EX_FILE_FORMAT_GROUPS Table... Error - ' + FFGroupInfo.ERROR_OBJECT, objLogInfo);
            CheckAndGetFFGJsonCB(null, FFGroupInfo.ERROR_OBJECT);
          }
          else {
            var SUCCESS_DATA = FFGroupInfo.SUCCESS_DATA;
            var ffgJson = '';
            if (!SUCCESS_DATA.length) {
              reqInstanceHelper.PrintInfo(serviceName, 'There is No Data Found From EX_FILE_FORMAT_GROUPS Table...', objLogInfo);
              CheckAndGetFFGJsonCB(null, 'There is No Data Found From EX_FILE_FORMAT_GROUPS Table...');
            } else {
              ffgJson = SUCCESS_DATA[0]["ffg_json"] ? JSON.parse(SUCCESS_DATA[0]["ffg_json"]) : {};
              CheckAndGetFFGJsonCB(ffgJson, null);
            }
          }
        });
      } else {
        var info = 'Required Fields are Missing...EXFFG_CODE - ' + EXFFG_CODE + ' CLIENT_ID - ' + CLIENT_ID + ' APP_ID - ' + APP_ID;
        reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
        CheckAndGetFFGJsonCB(null, info);
      }
    }
  } catch (error) {
    reqInstanceHelper.PrintInfo(serviceName, 'Error while Getting FFG Json...Error - ' + error, objLogInfo);
    CheckAndGetFFGJsonCB(null, error);
  }
}



function replaceText(inputString, replacementFor, replaceWith) {
  var regexp = new RegExp('\\' + replacementFor, 'g')
  var outputText = inputString.replace(replacementFor, replaceWith)
  return outputText
}

module.exports = {
  ExchangeEngine: ExchangeEngine,
  CallCodeSnippetByFFGCode: CallCodeSnippetByFFGCode
}