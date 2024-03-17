// Require dependencies
var dir_path = '../../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var commonFile = require('../util/Common.js');
var async = require(modPath + 'async');
var fs = require('fs');
const excel = require(modPath + 'node-excel-export');
var xlsx = require(modPath + 'node-xlsx');

function executeMain(reqObj) {
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
  const styles = {
    default: {
      fill: {
        fgColor: {
          rgb: 'FFFF00'
        }
      },
      font: {
        color: {
          rgb: '000000'
        },
        bold: true,
      }
    }
  }
  var report;

  if (data && data.length > 0) {
    var keys = Object.keys(data[0]);

    const header = [keys.join(",")]

    var specification = {};

    for (var i = 0; i < keys.length; i++) {
      specification[keys[i]] = {};
      specification[keys[i]]["displayName"] = keys[i];
      specification[keys[i]]["headerStyle"] = styles.default;
    }

    report = excel.buildExport(
      [{
        // name: reportName,
        specification: specification,
        data: data
      }]
    );

  } else {
    report = [];
  }

  callback(report);
}

function writeToFile(data, inputData, fileName, callback) {
  var path = inputData.PATH;
  var storagePath = inputData.storagePath;
  /* path = "D:\\Export\\write";
  storagePath = "D:\\Export\\storage\\"; */
  if (inputData.WRITE_METHOD == 'INSTANCE') {
    data.actualFileContent = [];
    var obj = {};
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
  } else {
    if (data.length == 0) {
      resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', {}, 'FAILURE', 'No Data Found')
      return callback(resObj)
    } else if (data.length == 1) {
      commonFile.PrintInfo('File writing process started for file ' + fileName + ' in path ' + path)

      excelDataPreparation(data[0], function (excelResponse) {
        async.series([
          function (seriesCallback) {

            fs.writeFile(storagePath + fileName, excelResponse, function (err) {
              if (err) {
                commonFile.PrintInfo('File writing process Failed in ' + storagePath + fileName + ' due to ' + JSON.stringify(err));
                resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
                return callback(resObj)
              }
              commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + storagePath + fileName)
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
            }

        /*     ,function (seriesCallback) {
              var fileNameTemp = path + fileName;
              fs.writeFile(fileNameTemp, excelResponse, function (err) {
                if (err) {
                  commonFile.PrintInfo('File writing process failed due to ' + err + ' for file ' + fileName)
                  resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
                  return callback(resObj)
                }
                commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + fileNameTemp)
                return seriesCallback(null);
              });
            } */
            
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


  var arr = []
  var totalArr = [];
  for (var index = 0; index < importFileReqObj.length; index++) {
    var filecontent = importFileReqObj[index]['fileContent'];
    if (typeof filecontent == "string") {
      filecontent = Buffer.from(filecontent);
    }



    arr = xlsx.parse(filecontent)

    var keys = arr[0]["data"][0];

    var data = arr[0]["data"]

    var totarrData = [];


    var objTemp = {};
    for (var k = 0; k < keys.length; k++) {
      objTemp[keys[k]] = "";
    }

    for (var i = 1; i < data.length; i++) {
      var arrData = data[i]

      var obj = {};
      for (var j = 0; j < arrData.length; j++) {
        if (obj[keys[j]] == arrData[j]) {
          obj[keys[j]] = ""
        } else {
          obj[keys[j]] = arrData[j];
        }

      }

      totarrData.push(obj);
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
      originalDataObj["_FILE_SETUP_NAME_"] = importFileReqObj[index]['name'];

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

  for (var index = 0; index < fieldFormats.length; index++) {
    Object.keys(jsonObj).forEach(function (key) {
      // change to disp_field
      try {
        if (fieldFormats[index]['disp_field'].toUpperCase() === key.trim().toUpperCase() || fieldFormats[index]['value_field'].toUpperCase() === key.trim().toUpperCase()) {
          if (key !== "_FILE_SETUP_NAME_") {
            // if(fieldFormats[index]['disp_field'].toUpperCase() === key.toUpperCase()){
            var data = cleanData(jsonObj[key], fieldFormats[index])

            if (fieldFormats[index]['ctrltype'] == 'CURRENCY' || fieldFormats[index]['ctrltype'] == 'NUMBER') {
              data = parseFloat(data);
            }

            if (fieldFormats[index]['ctrltype'] == 'DATETIME') {
              if (isNumeric(data)) {
                data = new Date(new Date((data - (25567 + 2)) * 86400 * 1000));
              } else {
                var date, month, year, hour, min, sec;
                var strDateTypeSlpit = fieldFormats[index].FORMAT.split('"');
                if (strDateTypeSlpit[1] == 'dd-MM-yyyy HH:mm:ss') {
                  var strDateTime = data.split(' ');
                  var strDate = strDateTime[0].split('-');
                  var strTime = strDateTime[1].split(':');
                  date = strDate[0];
                  month = strDate[1];
                  year = strDate[2];

                  hour = strTime[0];
                  min = strTime[1];
                  sec = strTime[2];
                  data = month + '-' + date + '-' + year + ' ' + hour + ':' + min + ':' + sec;
                }
                data = new Date(data).toString();
              }
            }

            clearedObj[fieldFormats[index]['value_field']] = data
            // clearedObj[fieldFormats[index]['disp_field']] = data    
            // }
          } else {
            clearedObj["_FILE_SETUP_NAME_"] = jsonObj[key];
          }
        }
      } catch (e) {
        console.log('Exc' + e)
      }

    })
  }
  return clearedObj
}


function isNumeric(value) {
  return /^-{0,1}\d+$/.test(value);
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