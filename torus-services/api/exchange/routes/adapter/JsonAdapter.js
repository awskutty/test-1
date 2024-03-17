// Require dependencies
var dir_path = '../../../../../'
var modPath = dir_path + 'node_modules/'
var refPath = dir_path + 'torus-references/'
var reqExpress = require(modPath + 'express')
var reqInstanceHelper = require(refPath + 'common/InstanceHelper')
var reqFXDBInstance = require(refPath + 'instance/DBInstance')
var commonFile = require('../util/Common.js')
var async = require(modPath + 'async')
var reqDBInstance = require(refPath + 'instance/DBInstance')
var fs = require('fs')
var path = require('path')



function executeMain(reqObj) {
  var textData = ''
  var applicableObj = ['DETAIL']
  var record_data = reqObj.RECORD_DATA_OBJ
  var records = ''
  var maxCount = reqObj.MAXIMUM_COUNT

  if (record_data !== {}) {
    // currently one loop only
    for (var index_app_obj = 0; index_app_obj < applicableObj.length; index_app_obj++) {
      // To get the record with respect to applicable object
      var records = record_data[applicableObj[index_app_obj]]
    }
  }

  return processData(records, maxCount)
}

function processData(processedData, maximum_count) {
  var temp = processedData
  var tempArr = []
  if (maximum_count !== '') {
    processedData = []
    var totalDatalength = temp.length
    var totalnoofFiles = Math.floor(Number(totalDatalength) / Number(maximum_count))
    var tempArr = []
    var resetCount = 0
    for (var ind = 0; ind < temp.length; ind++) {
      if (resetCount == Number(maximum_count)) {
        resetCount = 0
        processedData.push(tempArr)
        tempArr = []
      }
      if (temp[ind] == undefined) {
        temp[ind] = "";
      }
      tempArr.push(temp[ind])
      resetCount++
      if (Number(ind) === (totalDatalength - 1)) {
        if (tempArr.length > 0) {
          processedData.push(tempArr)
        }
      }
    }
  } else {
    var tempData = processedData
    processedData = []
    processedData.push(tempData)
  }

  return processedData
}

function writeToFile(data, inputData, fileName, callback) {
  var path = inputData.PATH;
  var storagePath = inputData.storagePath;
/*   path = "D:\\Export\\write\\";
  storagePath = "D:\\Export\\storage\\"; */
  if (inputData.WRITE_METHOD == 'INSTANCE') {
    data.actualFileContent = [];
    for (var i = 0; i < data.length; i++) {
        data.actualFileContent.push(JSON.stringify(data[i]));
    }
     var obj = {};
     obj.file_name = fileName;
     obj.data = data[0];
     resObj = commonFile.prepareMethodResponse('SUCCESS', '', JSON.stringify(obj.data), '', '', '', '', '');
     return callback(resObj);
  }
  else {

    if (data.length == 1) {
      commonFile.PrintInfo('File writing process started for file ' + fileName + ' in path ' + path)

      async.series([
        function (seriesCallback) {
          fs.writeFile(storagePath + fileName, JSON.stringify(data[0]), function (err) {
            if (err) {
              commonFile.PrintInfo('File writing process Failed in ' + storagePath + fileName + ' due to ' + JSON.stringify(err));
            }
            commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + storagePath + fileName)
            return seriesCallback(null);
          });
        },
        function (seriesCallback) {
          fs.writeFile(path + fileName, JSON.stringify(data[0]), function (err) {
            if (err) {
              commonFile.PrintInfo('File writing process failed due to ' + err + ' for file ' + path + fileName)
            }
            commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + path + fileName)
            return seriesCallback(null);
          });
        }
      ], function (seriesErr) {
        if (seriesErr) {
          resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', seriesErr, 'FAILURE', 'FAILURE')
          return callback(resObj)
        } else {
          resObj = commonFile.prepareMethodResponse('SUCCESS', '', [fileName], '', '', '', '', '')
          return callback(resObj)
        }
      })
    } else {
      var splitFile = fileName.split('.')
      var arrtemp = [];
      async.forEachOf(data, function (value, key, callbackAsync) {
        var fileName = splitFile[0] + '_' + key + '.' + splitFile[1]
        arrtemp.push(fileName);
        var storagePathTemp = storagePath + fileName
        var fileNameTemp = path + fileName;
        commonFile.PrintInfo('File writing process started for file ' + fileName)

        async.series([
          function (seriesCallback) {
            fs.writeFile(storagePathTemp, JSON.stringify(value), function (err) {
              if (err) {
                commonFile.PrintInfo('File writing process Failed in ' + storagePathTemp + ' due to ' + JSON.stringify(err));
              }
              commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + storagePathTemp)
              return seriesCallback(null);
            });
          },
          function (seriesCallback) {
            fs.writeFile(fileNameTemp, JSON.stringify(value), function (err) {
              if (err) {
                commonFile.PrintInfo('File writing process failed due to ' + err + ' for file ' + fileName)
              }
              commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + fileNameTemp)
              return seriesCallback(null);
            });
          }
        ], function (seriesErr) {
          if (seriesErr) {
            resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', seriesErr, 'FAILURE', 'FAILURE')
            return callback(resObj)
          } else {
            callbackAsync();
          }
        })
      }, function (err) {
        if (err) {
          resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
          return callback(resObj)
        } else {
          resObj = commonFile.prepareMethodResponse('SUCCESS', 'Files exported successfully', arrtemp, '', '', '', '', '')
          return callback(resObj)
        }
      })
    }
  }
}

function getOriginalData(inputData, callback) {
  var jsonDataArr = []
  var jsonDataObj = {}
  var totalData = []

  var dataGroup = {}

  var ffg_json = inputData.ruleObj
  var importFileReqObj = inputData.importFileReqObj
  var originalRequest = inputData.originalRequest
console.log("importFileReqObj.length",importFileReqObj.length)
  // verify
  var fieldFormats = ffg_json['FILE_FORMATS'][0]['RECORD_FORMATS'][0]['FIELD_FORMATS']
  // Iterate through all json files
  for (var index = 0; index < importFileReqObj.length; index++) {
    var originalDataArr = []
    // Get a json array
    var fileContent = JSON.parse(importFileReqObj[index]['fileContent']) || []
    var index_count_content = 0
    for (var indexFile = 0; indexFile < fileContent.length; indexFile++) {
      index_count_content++
      var originalDataObj = {}
      var jsonObj = fileContent[indexFile]
      var jsonObjKeys = Object.keys(jsonObj)


      originalDataObj = prepareOriginalData(jsonObj, fieldFormats)
      originalDataObj["_FILE_SETUP_NAME_"] = importFileReqObj[index]['name'];
      originalDataArr.push(originalDataObj)
    }
    totalData.push(originalDataArr)
  }

  dataGroup['TOTAL_DATA'] = totalData
  dataGroup['FIELD_FORMATS'] = fieldFormats
  console.log("TOTAL_DATA-------",JSON.stringify(dataGroup['TOTAL_DATA']))
  callback(dataGroup)
}

function prepareOriginalData(jsonObj, fieldFormats) {
  var clearedObj = {}
  Object.keys(jsonObj).forEach(function (key) {
    for (var index = 0; index < fieldFormats.length; index++) {
      // change to disp_field
      try {
        if (fieldFormats[index]['disp_field'].toUpperCase() === key.toUpperCase()) {
          var data = cleanData(jsonObj[key], fieldFormats[index])
           if(fieldFormats[index]['ctrltype'] == 'CURRENCY' || fieldFormats[index]['ctrltype'] == 'NUMBER'){
               data = parseFloat(data);
             }
	  
          clearedObj[fieldFormats[index]['value_field']] = data 
          
        }
      } catch (e) {
        console.log('Exc' + e)
      }
    }
  })
  return clearedObj
}

function replaceText(str, find, replace) {
  try {
    return str.replace(new RegExp(find, 'g'), replace)
  } catch (ex) {
    return str
  }
}

function cleanData(data, ruleObj) {

  // var fillers = ruleObj.fillers

  console.log('ORIGINAL DATA' + data)
  //data = replaceText(data, ruleObj.Preffix, '')
  //data = replaceText(data, ruleObj.Suffix, '')

  if(data.indexOf(ruleObj.Preffix) == 0){
    data = data.slice(ruleObj.Preffix.length)
  }
//data.endsWith(ruleObj.Suffix)
if(ruleObj.Suffix!="" && ruleObj.Suffix!=0){
  data = data.slice(0,-ruleObj.Suffix.length)
   }

  data = replaceText(data, ruleObj.fillers, '')

  console.log('CLEAN DATA' + data)

  // var length = formatter.length

  // if(length === 0){
  //     length = 1
  // }

  // if (prefix > 0) {
  //     prefix = Number(prefix) * Number(length)
  // }

  // if (suffix > 0) {
  //     suffix = Number(suffix) * Number(length)
  // }

  // if (prefix !== "" && prefix != 0) {
  //     data = data.slice(prefix)
  // }

  // if (suffix !== "" && suffix != 0) {
  //     data = data.slice(0, -(suffix))
  // }
  return data
}

module.exports = {
  ExecuteMain: executeMain,
  WriteToFile: writeToFile,
  GetOriginalData: getOriginalData
}