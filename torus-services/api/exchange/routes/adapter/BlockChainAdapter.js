// Require dependencies
var dir_path = '../../../../../';
var modPath = dir_path + 'node_modules/';
var commonFile = require('../util/Common.js');
var request = require(modPath + 'request');
var async = require(modPath + 'async');
var refPath = dir_path + 'torus-references/';
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqsvchelper = require('../../../../../torus-references/common/serviceHelper/ServiceHelper');


function executeMain(reqObj) {
  var applicableObj = ['DETAIL'];
  var record_data = reqObj.RECORD_DATA_OBJ;
  var records = '';
  var maxCount = reqObj.MAXIMUM_COUNT;

  if (record_data !== {}) {
    // currently one loop only
    for (var index_app_obj = 0; index_app_obj < applicableObj.length; index_app_obj++) {
      // To get the record with respect to applicable object
      records = record_data[applicableObj[index_app_obj]];
    }
  }
  for (var i = 0; i < records.length; i++) {
    Object.keys(records[i]).forEach(function (key) {
      Object.keys(reqObj.ORG_DATA[i]).forEach(function (orgkey) {

        if (key == orgkey.toUpperCase()) {
          records[i][key] = reqObj.ORG_DATA[i][orgkey];
        }
      });
    });

  }


  return records;
}


function processData(processedData, maximum_count) {
  var temp = processedData;
  var tempArr = [];
  if (maximum_count !== '') {
    processedData = [];
    var totalDatalength = temp.length;
    var totalnoofFiles = Math.floor(Number(totalDatalength) / Number(maximum_count));
    var tempArr = [];
    var resetCount = 0;
    for (var ind = 0; ind < temp.length; ind++) {
      if (resetCount == Number(maximum_count)) {
        resetCount = 0;
        processedData.push(tempArr);
        tempArr = [];
      }
      if (temp[ind] == undefined) {
        temp[ind] = "";
      }
      tempArr.push(temp[ind]);
      resetCount++;
      if (Number(ind) === (totalDatalength - 1)) {
        if (tempArr.length > 0) {
          processedData.push(tempArr);
        }
      }
    }
  } else {
    var tempData = processedData;
    processedData = [];
    processedData.push(tempData);
  }

  return processedData;
}

function writeToFile(data, inputData, fileName, callback) {
  var jwttoken = "";
  var argarr = [];

  for (var idx = 0; idx < data.length; idx++) {
    data[idx] = Object.keys(data[idx]).map(function (k) {
      return data[idx][k];
    }).join(",");
    data[idx] = data[idx].split(",");

    argarr.push(data[idx]);
  }

  gettenant_setup(inputData, function (pdata) {
    resarr = [];
    if (pdata.STATUS == "SUCCESS") {
      var url = inputData.headers.origin + "/BlockChain/invoke_transaction/";


      async.forEachOf(argarr, function (value, key, callbackAsync) {
        var input_request = {
          url: url,
          method: "POST",
          json: true,
          body: {
            chaincodeName: inputData["HL_CHAINCODE"],
            fcn: inputData["HL_CHAINCODE_FUNCTION"],
            args: value,
            channelName: pdata.data.HL_CHANNEL_NAME,
            network_name: pdata.data.HL_NETWORK_NAME,
            peers: pdata.data.HL_PEERS,
            username: inputData.SESSION.USER_NAME.toLowerCase(),
            orgName: inputData.SESSION.S_CODE,
            org_name: inputData.SESSION.S_CODE
          }
        };
        request(input_request, function (error, response, body) {
          if (body.data.STATUS != "FAILURE") {
            resarr.push({
              "STATUS": body.data.STATUS,
              DATA: body.data.SUCCESS_DATA
            });
            callbackAsync();
          } else {
            resarr.push({
              "STATUS": body.data.STATUS,
              DATA: body.data.SUCCESS_MESSAGE
            });
            callbackAsync();
          }
        });
      }, function (err) {
        if (!err) {
          resObj = commonFile.prepareMethodResponse("SUCCESS", "", resarr, "", "", "", "", "");
          callback(resObj);
        } else {
          resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120004", "", error, "", "");
          callback(resObj);
        }
      });

    } else {
      resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120008", pdata.data, error, "", "");
      callback(resObj);

    }

  });

}

function gettenant_setup(pparams, callback) {
  pparams["HL_SETUP"] = pparams.EVENT_PARAMS.raiseparam.hl_setup;
  pparams["HL_CHAINCODE"] = pparams.EVENT_PARAMS.raiseparam.hl_chaincode;
  pparams["HL_CHAINCODE_FUNCTION"] = pparams.EVENT_PARAMS.raiseparam.hl_chaincode_function;

  var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];

  if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
    var cond = {};
    cond.setup_code = pparams["HL_SETUP"];
    reqsvchelper.GetSetupJson(pparams.clt_cas_instance, cond, objLogInfo, function (res) {
      if (res.Status == 'SUCCESS' && res.Data.length) {
        var result = {
          "STATUS": "SUCCESS",
          "data": JSON.parse(res.Data[0].setup_json)
        };
        callback(result);
      } else {
        //return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error, 'FAILURE');
        var result = {
          "STATUS": "FAILURE",
          "data": "No Setup Found for Network Name"
        };
        callback(result);
      }
    });
  } else {
    var category = pparams["HL_SETUP"];
    reqFXDBInstance.GetTableFromFXDB(pparams.clt_cas_instance, 'tenant_setup', [], {
      'client_id': pparams.SESSION.CLIENT_ID,
      'tenant_id': pparams.SESSION.TENANT_ID,
      'category': category
    }, pparams.objLogInfo, function (error, presult) {
      if (!error) {
        if (presult.rows.length > 0) {
          var result = {
            "STATUS": "SUCCESS",
            "data": JSON.parse(presult.rows[0].setup_json)
          };
          callback(result);
        } else {
          var result = {
            "STATUS": "FAILURE",
            "data": "No Setup Found for Network Name"
          };
          callback(result);
        }

      } else {
        var result = {
          "STATUS": "FAILURE",
          "data": error
        };
        callback(result);
      }
    });
  }
}

function getOriginalData(inputData, callback) {
  var jsonDataArr = [];
  var jsonDataObj = {};
  var totalData = [];

  var dataGroup = {};

  var ffg_json = inputData.ruleObj;
  var importFileReqObj = inputData.importFileReqObj;
  var originalRequest = inputData.originalRequest;
  // verify
  var recordFormat = "";
  recordFormat = ffg_json['FILE_FORMATS'][0]['RECORD_FORMATS'];

  var detailFileFormat = "";
  var detailSeparatorPosition = 0;
  for (var i = 0; i < recordFormat.length; i++) {
    if (recordFormat[i]["Record_Format_Type"] == "DETAIL" || recordFormat[i]["Record_Format_Type"] == "HEADER") {
      detailFileFormat = recordFormat[i];
    }
  }
  var fieldFormats = ffg_json['FILE_FORMATS'][0]['RECORD_FORMATS'][0]['FIELD_FORMATS'];

  var recordCustomSeparator = ffg_json['FILE_FORMATS'][0]['CUSTOM_SEPERATOR'];
  var recordSeparator = (recordCustomSeparator == '') ? ffg_json['FILE_FORMATS'][0]["SEPERATOR"] : recordCustomSeparator;

  var fieldCustomSeparator = detailFileFormat["custom_seperator"];
  var fieldSeparator = (fieldCustomSeparator == '') ? detailFileFormat["seperator"] : fieldCustomSeparator;
  callback(dataGroup);
}


module.exports = {
  ExecuteMain: executeMain,
  WriteToFile: writeToFile,
  GetOriginalData: getOriginalData
};