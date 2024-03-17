// Require dependenciess
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
    // currently one loop onlyt
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
          // processedData = []
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


function excelDataPreparation(data, callback) {

  var str = "";

  if (data && data.length > 0) {
    var keys = Object.keys(data[0])

    const header = [keys.join(",")]

    var specification = {};

    str += header + "\n" + " ";
    for (var j = 0; j < data.length; j++) {
      var strTemp = "";
      for (var i = 0; i < keys.length; i++) {

        if (data[j][keys[i]] instanceof Date) {
          data[j][keys[i]].toString()
        }
        strTemp += data[j][keys[i]];
        strTemp += ","
      }
      strTemp.slice(0, -1);
      str += strTemp + "\n" + " ";
    }
  }

  callback(str);
}

function writeToFile(data, inputData, fileName, callback) {
  var path = inputData.PATH;
  var storagePath = inputData.storagePath;
  /* path = "D:\\Export\\write";
  storagePath = "D:\\Export\\storage\\"; */
  if (inputData.WRITE_METHOD == 'INSTANCE') {
    var obj = {};
    data.actualFileContent = [];
    async.forEachOf(data, function (value, index, CB) {
      excelDataPreparation(value, function (excelResponse) {
        data.actualFileContent.push(excelResponse);
        obj.file_name = fileName;
        obj.data = excelResponse;
        CB();
      });
    },
      function () {
        resObj = commonFile.prepareMethodResponse('SUCCESS', '', obj.data, '', '', '', '', '');
        return callback(resObj);
      });
  }
  else {
    if (data.length == 0) {
      resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', {}, 'FAILURE', 'No Data Found');
      return callback(resObj);
    } else if (data.length == 1) {
      commonFile.PrintInfo('File writing process started for file ' + fileName + ' in path ' + path);

      excelDataPreparation(data[0], function (excelResponse) {
        async.series([
          function (seriesCallback) {
            fs.writeFile(storagePath + fileName, excelResponse, function (err) {
              if (err) {
                commonFile.PrintInfo('File writing process Failed in ' + storagePath + fileName + ' due to ' + JSON.stringify(err));
                resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE');
                return callback(resObj);
              }
              commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + storagePath + fileName);
              return seriesCallback(null);
            });

          },
          function (seriesCallback) {

            fs.writeFile(path + fileName, excelResponse, function (err) {
              if (err) {
                commonFile.PrintInfo('File writing process failed due to ' + err + ' for file ' + path + fileName)
                resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
                return callback(resObj)
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

        excelDataPreparation(value, function (excelResponse) {
          async.series([
            function (seriesCallback) {
              fs.writeFile(storagePathTemp, excelResponse, function (err) {
                if (err) {
                  commonFile.PrintInfo('File writing process Failed in ' + storagePathTemp + ' due to ' + JSON.stringify(err));
                  resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
                  return callback(resObj)
                }
                commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + storagePathTemp)
                return seriesCallback(null);
              });
            },
            function (seriesCallback) {
              fs.writeFile(fileNameTemp, excelResponse, function (err) {
                if (err) {
                  commonFile.PrintInfo('File writing process failed due to ' + err + ' for file ' + fileName)
                  resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
                  return callback(resObj)
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
        });
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

  var ffg_json = inputData.ruleObj
  var importFileReqObj = inputData.importFileReqObj
  var originalRequest = inputData.originalRequest

  var fieldFormats = ffg_json['FILE_FORMATS'][0]['RECORD_FORMATS'][0]['FIELD_FORMATS']




  var totalArr = [];
  for (var index = 0; index < importFileReqObj.length; index++) {
    var filecontent = importFileReqObj[index]['fileContent'];
    if (typeof filecontent == "string") {
      filecontent = Buffer.from(filecontent);
    }

    var arr = filecontent.toString("utf-8").replace(/"/g, '')
    arr = arr.split("\n")


    for (var indx = 0; indx < arr.length; indx++) {
      if (arr[indx] == "" || (arr[indx].length == 1 && arr[indx][0] == " ")) {
        arr.splice(indx, 1);
      }
    }

    var keys = arr[0].split(",");

    var data = arr

    var totarrData = [];


    var objTemp = {};
    for (var k = 0; k < keys.length; k++) {
      objTemp[keys[k]] = "";
    }

    for (var i = 1; i < data.length; i++) {
      if (data[i] != undefined) {
        var arrData = data[i].split(",")

        var obj = {};
        for (var j = 0; j < arrData.length; j++) {
          // if (arrData[j] != "") {
          if (keys[j] != undefined) {
            keys[j] = keys[j].replace(/\r/g, '').replace(/\n/g, '');
          }

          if (arrData[j] != undefined) {
            if (arrData[j].trim() != "") {
              arrData[j] = arrData[j].replace(/\r/g, '').replace(/\n/g, '');
              obj[keys[j]] = arrData[j];
              obj["_FILE_SETUP_NAME_"] = importFileReqObj[index]['name'];

            }

          }
          // }
        }
        if (JSON.stringify(obj) != "{}") {
          totarrData.push(obj);
        }

      }
    }
    totalArr.push(totarrData);
  }


  var cleanedDataFinal = [];
  for (var index = 0; index < totalArr.length; index++) {
    var arrElement = totalArr[index];

    var originalDataArr = []

    for (var ind = 0; ind < arrElement.length; ind++) {
      var originalDataObj = {};
      originalDataObj = prepareOriginalData(arrElement[ind], fieldFormats)
      originalDataArr.push(originalDataObj)
    }
    cleanedDataFinal.push(originalDataArr);
  }


  var dataGroup = {}
  dataGroup['TOTAL_DATA'] = cleanedDataFinal
  dataGroup['FIELD_FORMATS'] = fieldFormats

  callback(dataGroup)

}

function prepareOriginalData(jsonObj, fieldFormats) {
  var clearedObj = {}
  Object.keys(jsonObj).forEach(function (key) {
    for (var index = 0; index < fieldFormats.length; index++) {
      // change to disp_field
      try {
        if (fieldFormats[index]['disp_field'].toUpperCase() === key.toUpperCase() || key == "_FILE_SETUP_NAME_") {
          if (key !== "_FILE_SETUP_NAME_") {
            var data = cleanData(jsonObj[key], fieldFormats[index])
            if (fieldFormats[index]['ctrltype'] == 'CURRENCY' || fieldFormats[index]['ctrltype'] == 'NUMBER') {
              data = parseFloat(data);
            }
            clearedObj[fieldFormats[index]['value_field']] = data
          }
          else {
            clearedObj["_FILE_SETUP_NAME_"] = jsonObj[key];
          }
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

  console.log('ORIGINAL DATA' + data)
  data = replaceText(data, ruleObj.Preffix, '')
  data = replaceText(data, ruleObj.Suffix, '')
  data = replaceText(data, ruleObj.fillers, '')

  console.log('CLEAN DATA' + data)

  return data
}


module.exports = {
  ExecuteMain: executeMain,
  WriteToFile: writeToFile,
  GetOriginalData: getOriginalData
}