// Require dependencies
var dir_path = '../../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var commonFile = require('../util/Common.js');
var async = require(modPath + 'async');
var TextParser = require('text2json').Parser
var reqDBInstance = require(refPath + 'instance/DBInstance');
var fs = require('fs');
var path = require('path')


function executeMain(reqObj) {
    var textData = "";
    var headerText = "";
    var subHeaderText = "";
    var footerText = "";
    var subFooterText = "";

    var maxCount = reqObj.MAXIMUM_COUNT;

    var processedobj = {};
    var finalArr = [];

    var applicableObj = ["HEADER", "SUB_HEADER", "DETAIL", "FOOTER", "SUBFOOTER"];
    var record_data = reqObj.RECORD_DATA_OBJ;
    var record_format_objs = reqObj.FILE_FORMAT_OBJ.RECORD_FORMATS;

    if (record_data !== {}) {

        headerText = processRecord(reqObj, "HEADER");
        subHeaderText = processRecord(reqObj, "SUBHEADER");
        footerText = processRecord(reqObj, "FOOTER");
        subFooterText = processRecord(reqObj, "SUBFOOTER");
        var detailDataArr = formDataForMaxCount(reqObj.ORG_DATA, record_data["DETAIL"], maxCount);

        for (var i = 0; i < detailDataArr.length; i++) {
            var textData = headerText + subHeaderText + processDetailRecord(reqObj, detailDataArr[i]) + subFooterText + footerText;
            finalArr.push(textData);
        }
    }

    return finalArr;
}

function processDetailRecord(reqObj, records) {
    var textData = "";
    var recordFormatSeparator = "";
    var otherSeparator = "";
    var record_format_objs = reqObj.FILE_FORMAT_OBJ.RECORD_FORMATS;
    var record_data = reqObj.RECORD_DATA_OBJ;
    for (var record of records) {
        // To get record key inside applicable obj types 
        var keys = Object.keys(record);

        // Loop through key(original data)
        for (var index_key of keys) {
            textData += record[index_key];
        }

        // To get record separator
        recordFormatSeparator = (record_data["SEPARATOR"] !== undefined) ? record_data["SEPARATOR"] : "\r\n";
        otherSeparator = record_data['CUSTOM_SEPERATOR'] || ''
        textData += commonFile.formulateSeparator(recordFormatSeparator, otherSeparator);
    }
    return textData;
}

function processRecord(reqObj, applicableObj) {
    var record_data = reqObj.RECORD_DATA_OBJ;
    var record_format_objs = reqObj.FILE_FORMAT_OBJ.RECORD_FORMATS;

    var textData = "";
    var recordFormatSeparator = "";
    var otherSeparator = "";
    var records = record_data[applicableObj];
    for (var index_rec_data = 0; index_rec_data < records.length; index_rec_data++) {
        var record = records[index_rec_data];
        // To get record key inside applicable obj types 
        var keys = Object.keys(record);

        // Loop through key(original data)
        for (var index_key = 0; index_key < keys.length; index_key++) {
            textData += (record[keys[index_key]] || "");
        }

        // To get record separator
        for (var index = 0; index < record_format_objs.length; index++) {
            if (record_format_objs[index]["Record_Format_Type"] === applicableObj) {
                recordFormatSeparator = (record_data["SEPARATOR"] !== undefined) ? record_data["SEPARATOR"] : "\r\n";
                otherSeparator = record_data['CUSTOM_SEPERATOR'] || ''
            }
        }

        textData += commonFile.formulateSeparator(recordFormatSeparator, otherSeparator);

    }
    return textData;
}

function formDataForMaxCount(org_data, processedData, maximum_count) {

    var tempArr = [];
    var temp = processedData;
    processedData = [];
    if (maximum_count) {
        var totalDatalength = temp.length;

        var resetCount = 0;
        for (var ind = 0; ind < totalDatalength; ind++) {
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
                    break;
                }
            }
        }
    } else {
        processedData.push(temp);

    }

    return processedData;
}


function writeToFile(data, inputData, fileName, callback) {
    data.actualFileContent = [];
    var path = inputData.PATH;
    var storagePath = inputData.storagePath;
    /* path = "D:\\Export\\write\\";
    storagePath = "D:\\Export\\storage\\"; */
    for (var i = 0; i < data.length; i++) {
        data[i] = data[i].replace(/undefined/g, '');
        if (inputData.WRITE_METHOD == 'INSTANCE') {
            data.actualFileContent.push(data[i]);
        }
    }
    if (inputData.WRITE_METHOD == 'INSTANCE') {
        var obj = {};
        obj.file_name = fileName;
        obj.data = data;

        resObj = commonFile.prepareMethodResponse('SUCCESS', '', obj.data, '', '', '', '', '');
        return callback(resObj);
    } else {

        if (data.length == 1) {
            data[0] = data[0].replace(/undefined/g, '');
            data[0] = data[0].trim();
            commonFile.PrintInfo("File writing process started for file " + fileName + " in path " + path);
            async.series([
                function (seriesCallback) {
                    fs.writeFile(storagePath + fileName, data[0], function (err) {
                        if (err) {
                            commonFile.PrintInfo('File writing process Failed in ' + storagePath + fileName + ' due to ' + JSON.stringify(err));
                            resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
                            return callback(resObj)
                        }
                        commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + storagePath + fileName)
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
            var splitFile = fileName.split(".");
            var arrtemp = [];
            async.forEachOf(data, function (value, key, callbackAsync) {

                value = value.replace(/undefined/g, '');
                value = value.trim();
                var fileName = splitFile[0] + '_' + key + '.' + splitFile[1];
                arrtemp.push(fileName);
                var storagePathTemp = storagePath + fileName;
                var fileNameTemp = path + fileName;
                commonFile.PrintInfo('File writing process started for file ' + fileName);

                async.series([
                    function (seriesCallback) {
                        fs.writeFile(storagePathTemp, value, function (err) {
                            if (err) {
                                commonFile.PrintInfo('File writing process Failed in ' + storagePathTemp + ' due to ' + JSON.stringify(err));
                                resObj = commonFile.prepareMethodResponse('FAILURE', '', '', '', '', '', 'FAILURE', 'FAILURE')
                                return callback(resObj);
                            }
                            commonFile.PrintInfo('File writing process ended for file ' + fileName + ' in ' + storagePathTemp)
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
    var importFileReqObj = inputData.importFileReqObj
    var hasHeader = false
    var dataGroup = {}

    var ffg_json = inputData.ruleObj

    var originalRequest = inputData.originalRequest
    console.log("importFileReqObj.length", importFileReqObj.length)

    var Headers = []
    var detailFileFormat = "";
    var detailSeparatorPosition = 0;

    var fieldFormats = ffg_json['FILE_FORMATS'][0]['RECORD_FORMATS'][0]['FIELD_FORMATS']


    var recordSeparator = ffg_json['FILE_FORMATS'][0]['CUSTOM_SEPERATOR'];

    if (recordSeparator == undefined || recordSeparator == "") {
        recordSeparator = ffg_json['FILE_FORMATS'][0]["SEPERATOR"]
    }
    recordSeparator = commonFile.formulateSeparator(recordSeparator)
    var fieldSeparator = ffg_json['FILE_FORMATS'][0]["RECORD_FORMATS"][0]["custom_seperator"];
    if (fieldSeparator == undefined || fieldSeparator == "") {
        fieldSeparator = ffg_json['FILE_FORMATS'][0]["RECORD_FORMATS"][0]["seperator"]
    }

    fieldSeparator = commonFile.formulateSeparator(fieldSeparator)


    // verify
    var recordFormat = "";
    recordFormat = ffg_json['FILE_FORMATS'][0]['RECORD_FORMATS']
    for (var i = 0; i < recordFormat.length; i++) {
        if (recordFormat[i]["Record_Format_Type"] == "DETAIL") {
            detailFileFormat = recordFormat[i];
        } if (recordFormat[i]["Record_Format_Type"] == "HEADER") {
            hasHeader = true
        }
    }


    if (!hasHeader) {
        for (var i = 0; i < fieldFormats.length; i++) {
            Headers.push(fieldFormats[i].value_field)
        }

    }
    var parse = new TextParser({ hasHeader: hasHeader, headers: Headers, separator: fieldSeparator, newline: recordSeparator })

    var totalData = []
    // async.forEachOf(importFileReqObj, function (value, key, asyncCallback) {
    parse.text2json(importFileReqObj[0].fileContent)
        .on('error', (err) => {
            console.error(err)
        })
        .on('headers', (headers) => {
            console.log(headers)
        })
        .on('row', (row) => {
            console.log(row)

            totalData.push(row)
        })
        .on('end', () => {
            for (var i = 0; i < totalData.length; i++) {
                for (var j = 0; j < importFileReqObj.length; j++) {
                    totalData[i]["_FILE_SETUP_NAME_"] = importFileReqObj[j]['name'];
                }
                for (var key in totalData[i]) {
                    if (totalData[i].hasOwnProperty(key)) {
                        if (key.indexOf("_") == 0)
                            delete totalData[i][key];
                    }
                }
            }
            dataGroup['TOTAL_DATA'] = [totalData]
            dataGroup['FIELD_FORMATS'] = fieldFormats
            callback(dataGroup)
            //  asyncCallback();
        })


    //   }, function (err) {
    //if(!err){
    //     dataGroup['TOTAL_DATA'] = totalData
    //   dataGroup['FIELD_FORMATS'] = fieldFormats
    //     callback(dataGroup)
    //}
    ///  })







}

function prepareOriginalData(jsonObj, fieldFormats) {
    var clearedObj = {}
    Object.keys(jsonObj).forEach(function (key) {
        for (var index = 0; index < fieldFormats.length; index++) {
            // change to disp_field
            try {
                if (fieldFormats[index]['value_field'].toUpperCase() === key.toUpperCase()) {
                    var data = cleanData(jsonObj[key], fieldFormats[index])
                    if (fieldFormats[index]['ctrltype'] == 'CURRENCY' || fieldFormats[index]['ctrltype'] == 'NUMBER') {
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

module.exports = {
    ExecuteMain: executeMain,
    WriteToFile: writeToFile,
    GetOriginalData: getOriginalData
}