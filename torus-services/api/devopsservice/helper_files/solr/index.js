var Path = require("path");
var FileSystem = require("fs");
var redisHelper = require("../redis")
var helper = require("../../helper")

async function CreateSolrEntries(ClientParams) {
    console.log("CreateSolrEntries function called");
    var tempDeployPath = ClientParams.BackendPath;
    var SolorJson = Path.join(tempDeployPath, 'solr_json.json');
    if (FileSystem.existsSync(SolorJson)) {
        var strQueryJson = FileSystem.readFileSync(SolorJson).toString();
        var objQueryJson = [];
        if (strQueryJson != "") {
            strQueryJson = strQueryJson.split("$DQ$").join('"');
            strQueryJson = strQueryJson.split("$SQ$").join("'");
            strQueryJson = strQueryJson.split("$SL$").join("\\");
            objQueryJson = helper.ParseJson(strQueryJson);
        }

        //var key = "SOLR_SEARCH~"+ClientParams.headers.routingkey;
        var key = "SOLR_SEARCH~CLT-0~APP-0~TNT-0~ENV-0";
        var redisSession = await redisHelper.GetRedisConnection();
        var SolrRedisData = await redisHelper.GetRedisData(redisSession,key);
        SolrRedisData = JSON.parse(SolrRedisData);
        var objSolrConfig = {
            URI: helper.StringFormat("http://{0}:{1}/solr/", SolrRedisData.SERVER, SolrRedisData.PORT),
            TRACE_LOG_CORE: null,
            AUDIT_LOG_CORE: null,
            LANG_DICTIONARY: null,
            LANG_DIC_NAMESPACE: null
        };
        if(SolrRedisData.CORE && Object.keys(SolrRedisData.CORE).length>0) {
            for(var prop in SolrRedisData.CORE) {
                objSolrConfig[prop] = SolrRedisData.CORE[prop];
            }
        }
        var FailedSolrJson = [];
        for (var islr = 0; islr < objQueryJson.length; islr++) {
            var objSolrInfo = objQueryJson[islr];
            var FailedJsonInfo = {
                "TRAN_INSERTION" : [],
                "TRAN_DELETION" : [],
                "ATMT_INSERTION" : []
            }
            var NeedAppend = false;
            if (objSolrInfo["TRAN_INSERTION"] && objSolrInfo["TRAN_INSERTION"].length > 0) {
                var objInsertTranFields = objSolrInfo["TRAN_INSERTION"];
                var Result = await __CreateSolrSearchField(objSolrConfig, objInsertTranFields, true);
                if (Result != "SUCCESS") {
                    NeedAppend = true;
                    FailedJsonInfo["TRAN_INSERTION"] = objSolrInfo["TRAN_INSERTION"];
                }
            }
    
            if (objSolrInfo["TRAN_DELETION"] && objSolrInfo["TRAN_DELETION"].length > 0) {
                var objDeleteTranFields = objSolrInfo["TRAN_DELETION"];
                var Result = await __DeleteSolrSearchField(objSolrConfig, objDeleteTranFields, true)
                if (Result != "SUCCESS") {
                    NeedAppend = true;
                    FailedJsonInfo["TRAN_DELETION"] = objSolrInfo["TRAN_DELETION"];
                }
            }
    
            if (objSolrInfo["ATMT_INSERTION"] && objSolrInfo["ATMT_INSERTION"].length > 0) {
                var objInsertAtmtFields = objSolrInfo["ATMT_INSERTION"];
                var Result = await __CreateSolrSearchField(objSolrConfig, objInsertAtmtFields, false);
                if (Result != "SUCCESS") {
                    NeedAppend = true;
                    FailedJsonInfo["ATMT_INSERTION"] = objSolrInfo["ATMT_INSERTION"];
                }
            }
            if(NeedAppend) {
                FailedSolrJson.push(FailedSolrJson);
            }
        }   
        ClientParams.FailedQueries["solr"] = FailedSolrJson;
        console.log("CreateSolrEntries function ended");
    }
}

async function __CreateSolrSearchField(objSolrConfig, pFields, pTran) {
    console.log("__CreateSolrSearchField function called");
    var CoreName = "";
    if (pTran) {
        if(objSolrConfig.DYNAMIC_CORE) {
            CoreName = objSolrConfig.DYNAMIC_CORE;
        } else if(objSolrConfig.TRAN) {
            CoreName = objSolrConfig.TRAN;
        }
    } else {
        if(objSolrConfig.STATIC_CORE) {
            CoreName = objSolrConfig.STATIC_CORE;
        } else if(objSolrConfig.TRAN_ATMT_CONTENT) {
            CoreName = objSolrConfig.TRAN_ATMT_CONTENT;
        }
    }
    var strSolrUri = objSolrConfig.URI;
    if (!strSolrUri.endsWith("/")) {
        strSolrUri = strSolrUri & "/";
    }

    var strRespMethod = {
        "wt": "json"
    };
    if (pFields.length > 0) {
        var strSchemaQuery = strSolrUri + CoreName + "/schema/fields";
        var strFieldCreate = strSolrUri + CoreName + "/schema?commit=true";
        var objFieldData = {};
        var strResponseData = await helper.HttpRequest(strSchemaQuery, "GET", undefined, undefined, undefined, undefined, strRespMethod);
         var objFieldData = await helper.ParseJson(strResponseData);
        if (!objFieldData) {
            throw new Error(strResponseData);
        }
        var ExisitingField = objFieldData["fields"];
        for (var idr = 0; idr < pFields.length; idr++) {
            var FieldInfo = pFields[idr];
            var FieldItem = undefined;
            for (var oFld = 0; oFld < ExisitingField.length; oFld++) {
                var pField = ExisitingField[oFld];
                if (pField["name"].toString().toUpperCase() == FieldInfo["NAME"].toString().toUpperCase()) {
                    FieldItem = pField;
                }
            }
            if (!FieldItem) {
                var strFieldInfo = helper.ParseJson(helper.StringFormat("{{ \"add-field\" : {{ \"name\" : \"{0}\", \"type\" : \"{1}\" , \"stored\" : {2}, \"indexed\" : {3}, \"required\" : {4} }} }}", FieldInfo["NAME"].toString(), __GetSolrFieldType(FieldInfo["TYPE"].toString()), "true", "true", "false"));
                var strInsertResult = await helper.HttpRequest(strFieldCreate, "POST", strFieldInfo, "application/json", undefined, undefined, strRespMethod);
                var objFieldRes = helper.ParseJson(strInsertResult);
                if (!objFieldRes) {
                    throw new Error(strInsertResult);
                }
                var objFieldError = objFieldRes["errors"];
                if (objFieldError && objFieldError.length > 0) {
                    var sbError = new stringbuilder()
                    objFieldError.forEach(function(err) {
                        if (sbError.toString() != "") {
                            sbError.appendLine();
                        }
                        if(err["errorMessages"].toString().indexOf("already exists")==-1) {
                            sbError.append(err["errorMessages"].toString());
                        }
                    });
                    if (sbError.toString() != "") {
                    throw new Error(sbError.toString())
                    }
                }
            } else if (!FieldItem["indexed"]) {
                FieldItem["NAME"] = FieldItem["name"].toString();
                var DeleteItem = [];
                DeleteItem.push(FieldItem);
                __DeleteSolrSearchField(objSolrConfig, DeleteItem, pTran)
                var strFieldInfo = helper.ParseJson(helper.StringFormat("{{ \"add-field\" : {{ \"name\" : \"{0}\", \"type\" : \"{1}\" , \"stored\" : {2}, \"indexed\" : {3}, \"required\" : {4} }} }}", FieldInfo["NAME"].toString(), __GetSolrFieldType(FieldInfo["TYPE"].toString()), "true", "true", "false"));
                var strInsertResult = await helper.HttpRequest(strFieldCreate, "POST", strFieldInfo, "application/json", undefined, undefined, strRespMethod);
                var objFieldRes = helper.ParseJson(strInsertResult);
                if (!objFieldRes) {
                    throw new Error(strInsertResult);
                }
                var objFieldError = objFieldRes["errors"];
                if (objFieldError && objFieldError.length > 0) {
                    var sbError = new stringbuilder();
                    objFieldError.forEach(function(err) {
                        if (sbError.toString() != "") {
                            sbError.appendLine();
                        }
                        if(err["errorMessages"].toString().indexOf("already exists")==-1) {
                            sbError.append(err["errorMessages"].toString());
                        }
                        
                    });
                    if (sbError.toString() != "") {
                    throw new Error(sbError.toString());
                    }
                }
            }
        }

        //Fake Delete
        try {
            var strFakeDeleteUri = strSolrUri + CoreName + "/update?commit=true";
            var strDeleteQry = elper.StringFormat("<delete><query>id:{0}</query></delete>", "0");
            var strFakeDeleteResult = await helper.HttpRequest(strFakeDeleteUri, "POST", strDeleteQry, "application/json", undefined, undefined, {
                "wt": "xml"
            });
            var objFakeRes = helper.ParseJson(strFakeDeleteResult);
            if (!objFakeRes) {
                throw new Error(strFakeDeleteResult);
            }
        } catch (e) {}
    }
    console.log("__CreateSolrSearchField function ended");
    return "SUCCESS";
};

async function __DeleteSolrSearchField(objSolrConfig, pFields, pTran) {
    console.log("__DeleteSolrSearchField function started");
    var CoreName = "";
    if (pTran) {
        if(objSolrConfig.DYNAMIC_CORE) {
            CoreName = objSolrConfig.DYNAMIC_CORE;
        } else if(objSolrConfig.TRAN) {
            CoreName = objSolrConfig.TRAN;
        }
    } else {
        if(objSolrConfig.STATIC_CORE) {
            CoreName = objSolrConfig.STATIC_CORE;
        } else if(objSolrConfig.TRAN_ATMT_CONTENT) {
            CoreName = objSolrConfig.TRAN_ATMT_CONTENT;
        }
    }
    var strSolrUri = objSolrConfig.URI;
    if (!strSolrUri.endsWith("/")) {
        strSolrUri = strSolrUri & "/";
    }

    var strRespMethod = {
        "wt": "json"
    };
    if (pFields.length > 0) {
        var strSchemaQuery = strSolrUri + CoreName + "/schema/fields";
        var strFieldDelete = strSolrUri + CoreName + "/schema?commit=true"
        var strResponseData = await helper.HttpRequest(strSchemaQuery, "GET", undefined, undefined, undefined, undefined, strRespMethod);
        var objFieldData = helper.ParseJson(strResponseData);
        if (!objFieldData) {
            throw new Error(strResponseData);
        }
        var ExisitingField = objFieldData["fields"];
        for (var idr = 0; idr < pFields.length; idr++) {
            var FieldInfo = pFields[idr];
            var FieldExists = false;
            for (var oFld = 0; oFld < ExisitingField.length; oFld++) {
                var pField = ExisitingField[oFld];
                if (pField["name"].toString().toUpperCase() == FieldInfo["NAME"].toString().toUpperCase()) {
                    FieldExists = true;
                }
            }
            if (FieldExists) {
                var strFieldInfo = helper.ParseJson(helper.StringFormat("{{ \"delete-field\" : {{ \"name\" : \"{0}\" }} }}", FieldInfo["NAME"].toString()));
                var strDeleteResult = await helper.HttpRequest(strFieldDelete, "POST", strFieldInfo, "application/json", undefined, undefined, strRespMethod);
                var objFieldRes = helper.ParseJson(strDeleteResult);
                if (!objFieldRes) {
                    throw new Error(strDeleteResult);
                }
                var objFieldError = objFieldRes["errors"];
                if (objFieldError && objFieldError.length > 0) {
                    var sbError = new stringbuilder();
                    objFieldError.forEach(function(err) {
                        if (sbError.toString() != "") {
                            sbError.appendLine();
                        }
                        if(err["errorMessages"].toString().indexOf("already exists")==-1) {
                            sbError.append(err["errorMessages"].toString());
                        }
                    });
                    if (sbError.toString() != "") {
                    throw new Error(sbError.toString());
                    }
                }
            }
        }

        //Fake Delete
        try {
            var strFakeDeleteUri = strSolrUri + CoreName + "/update?commit=true";
            var strDeleteQry = helper.StringFormat("<delete><query>id:{0}</query></delete>", "0");
            var strFakeDeleteResult = await helper.HttpRequest(strFakeDeleteUri, "POST", strDeleteQry, "application/json", undefined, undefined, {
                "wt": "xml"
            });
            var objFakeRes = helper.ParseJson(strFakeDeleteResult);
            if (!objFakeRes) {
                throw new Error(strFakeDeleteResult);
            }
        } catch (e) {}
    }
    console.log("__DeleteSolrSearchField function ended");
    return "SUCCESS";
};

 function __GetSolrFieldType(pName) {
    var FieldType = "";
    switch (pName) {
        case "TEXT":
            FieldType = "text_general";
            break;
        case "NUMBER":
            FieldType = "int"
            break;
        case "DATETIME":
            FieldType = "date"
            break;
        case "DATE":
            FieldType = "date"
            break;
        default:
            FieldType = "string"
            break;
    };
    return FieldType;
};

function stringbuilder(params) {
    if (this instanceof stringbuilder == false) {
        throw new Error("please use keyword new for stringbuilder...");
    }
    this.__mString = "";
    this.append = function(pStr) {
        pStr = pStr || "";
        this.__mString = this.__mString + pStr;
    };
    this.appendLine = function(pStr) {
        if (pStr) {
            if (this.__mString != "") {
                this.__mString = this.__mString + "\r\n" + pStr + "\r\n";
            }
        } else {
            if (this.__mString != "") {
                this.__mString = this.__mString + "\r\n";
            }
        }
    };
    this.appendFormat = function(pStr) {
        pStr = pStr || "";
        this.__mString = this.__mString + helper.StringFormat.apply(null, arguments);
    };
    this.toString = function() {
        return this.__mString.toString();
    };
    this.toInlineString = function() {
        return this.__mString.replace(/(\r\n|\n|\r)/gm, "").toString();
    };
};

module.exports = {
    CreateSolrEntries : CreateSolrEntries
}