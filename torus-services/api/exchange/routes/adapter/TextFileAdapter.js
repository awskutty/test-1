/**
 * @Description     : Exchange text file Helper
 * @Last_Error_Code : 
 */

// Require dependencies
var dir_path = '../../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var commonFile = require('../util/Common.js');
var async = require(modPath + 'async');
var reqDBInstance = require(refPath + 'instance/DBInstance');
var fs = require('fs');
var path = require('path')




function exportTextFile(exportFileReqObj, callBackExportFile) {
    if (exportFileReqObj.WRITE_METHOD === "INSTANCE") {
        var databindingarray = exportFileReqObj.DATA_BINDING
        var septr = exportFileReqObj.SEPERATOR


     
        GetInstanceTextString(GetFileData(databindingarray),exportFileReqObj["separator"])
        var dtresult = Getoutputtablestruct()
        dtresult.Rows.Add("", "", "", display.ToString, "SUCCESS", "", "", "", "", "")
        MyBase.Result = dtresult
    } else {
        var Trn_Ids = ""
        var display = ""
        var dtresult = ""
        display = GetTextString(GetFileData(exportFileReqObj));
        var dirname = File_Path
        var FILENAME = path.basename(File_Path)
        if (!fs.exists(dirname)) {
            fs.mkdir(dirname, function (err) {
                if (err) {

                }
                WriteTextFile(display, File_Path, function (pres) {
                    callBackExportFile
                    dtresult.Rows.Add(File_Param("EXFF_ID"), FILENAME, dirname, "", "SUCCESS", Trn_Ids, File_Param("EXFFG_ID"), "", FILENAME + ".zip", "N")
                })
            });
        } else {
            WriteTextFile(display, File_Path, function (pres) {
                callBackExportFile
                dtresult.Rows.Add(File_Param("EXFF_ID"), FILENAME, dirname, "", "SUCCESS", Trn_Ids, File_Param("EXFFG_ID"), "", FILENAME + ".zip", "N")
            })
        }
    }
}


function GetInstanceTextString(reqData,separator){
    var textString = "";
    var keys = Object.keys(reqData["field"][0]);
    for(var index in reqData["field"]){
        for(var index_2 in keys){
            textString += reqData["field"][i][index_2] + Separator(separator);
        }
    }

    return textString;
}


function Separator(charname) {

    if (charname.toUppercase() == "VBCRLF" || charname.toUppercase() == "NEWLINE") {
        return "/(?:\r\n|\r|\n)/g, '<br />"
    } else if (charname.toUppercase() == "VBTAB") {
        return "/\t/g, ''"
    } else if (charname.tostring() == ";") {
        return ";"
    } else if (charname.tostring() == ",") {

        return ","
    } else {
        return charname
    }
}

function GetTextString(reqObj, callBackGetTextString) {
    var input = reqObj.RECORD_FORMATS;
    var element_name = "";
    var rid = "";
    var displayString = "";

    for (var index in input) {
        element_name = input[index]["record_format_name"];
        rid = input[index]["record_format_id"];
        displayString += GetText(input[index], rid)
    }

    return displayString;
}

function GetText(record_format, rid) {
    var fieldFormats = record_format["FIELD_FORMATS"];
    var outputText = "";

    for (var index in fieldFormats) {
        var separator = fieldFormats[index]["separator"];
        var dispField = fieldFormats[index]["disp_field"];

        outputText += displayFields(fieldFormats[index],dispField,separator);
    }

    return outputText;
}

function displayFields(fieldFormat, dispField, separator) {
    var length = fieldFormat["length"];
    var format = fieldFormat["format"];
    var result = "";

    if (format !== "") {
        var condition = format.split(";");

        if (condition.length == 2) {
            switch (condition[0]) {
                case "PADLEFT":
                    dispField = padvalues(dispField, condition[1], "LEFT");
                    break;
                case "PADRIGHT":
                    dispField = padvalues(dispField, condition[1], "RIGHT");
                    break;
            }

            result = _separator(fieldFormat["prefix_value"]) + dispField + _separator(fieldFormat["suffix_value"]) + _separator(separator);
        }
    }

    return result;
}

function padvalues(data, padCountCondition, direction) {
    var paddedData = "";
    var result = "";
    if (data.length < padCountCondition) {
        var loopCount = padCountCondition - data.length;

        for (var index in loopCount) {
            paddedData += "0";
        }
    }

    if (direction === "LEFT") {
        result = paddedData + data;
    } else {
        result = data + paddedData;
    }

    return result;
}

function _separator(data) {
    if (data.toUppercase() === "VBCRLF" || data.toUppercase() === "NEWLINE") {
        return "vbCrLf";
    } else if (data.toUppercase() === "VBTAB") {
        return "vbTab";
    } else {
        return data;
    }
}

function _GetInstanceTextString(reqObj, callBackInstanceTextString) {
    var resObj = {};
    try {
        var process = reqobj.PROCESS || "";
        if (process !== "") {
            var processKeys = Object.keys(process).join();

        } else {

        }
    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "", error, "", "");
        callBackFileFormatGroups(resObj);
    }
}


function _DISPLAY_FIELDS(record, valuerow, separator) {

}



function writeFields(record, valuerow, datatype, Seperator) {
    var Temp = ""

    if (valuerow == null) {
        valuerow = ""
    }


    Temp = valuerow & Separator(Seperator)
    return Temp


}


function WriteTextFile(pContent, path, pcallback) {

    fs.writeFile(path, pContent, function (err) {
        if (err) {
            pcallback("FAILURE")
        } else {
            pcallback("SUCCESS")
        }
    });


}

module.exports = {
    ExportTextFile: exportTextFile
}