/**
 * @Author - Ragavendran
 * @Description - Helper for AQM(Application Quality management)
 * @status - InProgress
 */

var rootpath = "../../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('../util/message');
var async = require(modPath + 'async');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')
var vsprintf = require(modPath + 'sprintf').vsprintf;
var objLogInfo = "";
var headers = "";
var reqDateFormatter = require(rootpath + 'torus-references/common/dateconverter/DateFormatter')

/**
 * To lock 
 * @param cassInst - Cassandra instance
 * @param pcondition - Query condition
 * 
 * @return - locked_by data / exception
 */
function AQMlocking(mDevCas, pCondition, pHeaders, callback) {
    headers = pHeaders;
    var query = "select * from aqm_ar_designer_locks where " + pCondition;

    try {

        reqFXDBInstance.ExecuteQuery(mDevCas, query, objLogInfo, function (pErr, pResult) {
            if (pErr) {
                callback("Error on AQMdesignersave Function");
            } else {
                if (pResult.rows.length > 0) {
                    for (var i in pResult.rows) {
                        if (pResult.rows[i]["locked_by"] !== "" && pResult.rows[i]["locked_by"] !== null) {
                            callback(pResult.rows[i]["locked_by"].toString());
                        }
                    }
                } else {
                    callback("");
                }

            }
        })
    } catch (ex) {
        callback("Exception : " + ex.toString());
    }

}


function AQMdesignersave(mDevCas, pAPP_ID, pCLIENT_ID, pAPP_NAME, pDESIGNER_NAME, pCATEGORY, pCODE, pUSER_ACTION, pU_NAME, pAPP_REQ_ID, pGROUP_CATEGORY, pSELECTQUERY, pDELETEQUERY, pWFTPA_ID, pCOMMENT, pGROUP_CODE, pHeaders, callback) {

    headers = pHeaders;
    var QUERTY_AQM_DESIGNER_CHANGES = "insert into aqm_designer_changes(client_id,code,app_id,category,group_code,wftpa_id,comments,created_by,created_date,delete_query,group_category) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)";
    var QUERY_AQM_WFTPA_DESIGNER_CHANGES = "insert into aqm_wftpa_designer_changes(app_id,wftpa_id,group_code,category,code,comments,created_by,created_date,delete_query) values(%s,%s,%s,%s,%s,%s,%s,%s,%s)";

    // if (pCODE == "" || pCODE == "0" || pCODE.tolower().contains("~default")) {
    //     callback("");
    // }

    async.series([
        function (asyncCallBack) {
            try {
                var parsed_query = vsprintf(QUERTY_AQM_DESIGNER_CHANGES, [addSingleQuote(pCLIENT_ID), addSingleQuote(pCODE), addSingleQuote(pAPP_ID), addSingleQuote(pCATEGORY), addSingleQuote(pGROUP_CODE), addSingleQuote(pWFTPA_ID), addSingleQuote(pCOMMENT), addSingleQuote(pU_NAME.toString().toUpperCase()), dateString(new Date()), addSingleQuote(pDELETEQUERY), addSingleQuote(pGROUP_CATEGORY)]);

                reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
                    if (pErr) {
                        callback("Error on AQMdesignersave Function");
                    } else {
                        asyncCallBack();
                    }
                });
            } catch (ex) {
                callback("Exception : " + ex.toString());
            }
        },
        function (asyncCallBack) {
            try {
                var parsed_query1 = vsprintf(QUERY_AQM_WFTPA_DESIGNER_CHANGES, [addSingleQuote(pAPP_ID), addSingleQuote(pWFTPA_ID), addSingleQuote(pGROUP_CODE), addSingleQuote(pCATEGORY), addSingleQuote(pCODE), addSingleQuote(pCOMMENT), addSingleQuote(pU_NAME.toString().toUpperCase()), dateString(new Date()), addSingleQuote(pDELETEQUERY)]);

                reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query1, objLogInfo, function (pErr, pResult) {
                    if (pErr) {
                        callback("Error on AQMdesignersave Function");
                    } else {
                        asyncCallBack()
                    }
                });
            } catch (ex) {
                callback("Exception : " + ex.toString());
            }
        },
        function (asyncCallBack) {

            AQMardesignersave(mDevCas, pAPP_ID, pAPP_NAME, pDESIGNER_NAME, pCATEGORY, pCODE, pSELECTQUERY, pUSER_ACTION, pU_NAME, pAPP_REQ_ID, headers, function (resAQMardesignersave) {
                asyncCallBack();
            });
        }
    ], function (err) {
        if (err) {
            callback("ERROR " + err.toString());
        }
        else {
            callback("SUCCESS");
        }
    })
}


function AQMardesignersave(mDevCas, APP_ID, APP_NAME, DESIGNER_NAME, CATEGORY, CODE, SELECTQUERY, USER_ACTION, U_NAME, APP_REQ_ID, pHeaders, callback_aqm) {
    headers = pHeaders;
    var query = "insert into aqm_ar_designer_changes(app_id,app_name,app_req_id,designer_name,category,code,select_query,user_action,need_build,created_by,created_date,fx_version_no) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)";
    var lockquery = "insert into aqm_ar_designer_locks(app_id,app_req_id,designer_name,category,code,created_by,created_date,locked_by,locked_date) values(%s,%s,%s,%s,%s,%s,%s,%s,%s)"


    async.series([
        function (asyncCallBack) {
            try {
                var parsed_query = vsprintf(query, [addSingleQuote(APP_ID), addSingleQuote(APP_NAME), addSingleQuote(APP_REQ_ID), addSingleQuote(DESIGNER_NAME), addSingleQuote(CATEGORY), addSingleQuote(CODE), addSingleQuote(SELECTQUERY), addSingleQuote(USER_ACTION), addSingleQuote("Y"), addSingleQuote(U_NAME.toString().toUpperCase()), dateString(new Date()), addSingleQuote('6.0')]);
                reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
                    if (pErr) {
                        callback("Error on AQMdesignersave Function");
                    } else {
                        asyncCallBack();
                    }
                });
            } catch (ex) {
                callback("Exception : " + ex.toString());
            }
        },
        function (asyncCallBack) {
            try {
                var parsed_query1 = vsprintf(lockquery, [addSingleQuote(APP_ID), addSingleQuote(APP_REQ_ID), addSingleQuote(DESIGNER_NAME), addSingleQuote(CATEGORY), addSingleQuote(CODE), addSingleQuote(U_NAME.toString()), dateString(new Date()), addSingleQuote(U_NAME.toString()), dateString(new Date())]);

                reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query1, objLogInfo, function (pErr, pResult) {
                    if (pErr) {
                        callback("Error on AQMdesignersave Function");
                    } else {
                        asyncCallBack()
                    }
                });
            } catch (ex) {
                callback("Exception : " + ex.toString());
            }
        }
    ], function (err) {
        callback_aqm("SUCCESS");
    })




    // try {
    //     reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function(pErr, pResult) {
    //         if (pErr) {
    //             callback_aqm("Error on AQMdesignersave Function");
    //         } else {
    //             callback_aqm("SUCCESS");
    //         }
    //     });
    // } catch (ex) {
    //     callback_aqm("Exception : " + ex.toString());
    // }
}

function AQMModification(mDevCas, pCLIENT_ID, pAPP_ID, pCATEGORY, pCODE, pGROUPCODE, GENIUS, pHeaders, callbackmain) {
    headers = pHeaders;
    var QUERY_AQMDC = "select app_id,category,code,group_code,wftpa_id from aqm_designer_changes where client_id=%s and code =%s and app_id=%s and category=%s and group_code=%s";
    var QUERY_AQM_WFTPA_DC = "select code,app_id,category,group_code from aqm_wftpa_designer_changes where app_id=%s and wftpa_id =%s and group_code=%s and category=%s";
    var QUERY_AQM_WFTPA_DC2 = "select code,app_id,category,group_code from aqm_wftpa_designer_changes where app_id=%s and wftpa_id =%s and group_code=%s";
    var QUERY_AQM_WFTPA_DEL1 = "delete from aqm_wftpa_designer_changes where app_id=%s and wftpa_id =%s and group_code=%s and category='%s";
    var QUERY_AQM_WFTPA_DEL2 = "delete from aqm_wftpa_designer_changes where app_id=%s and wftpa_id =%s and group_code=%s";

    var AQM_WFTPA_DC = [];


    var PARSED_QUERY_AQMDC = vsprintf(QUERY_AQMDC, [addSingleQuote(pCODE), addSingleQuote(pAPP_ID), addSingleQuote(pCATEGORY), addSingleQuote(pGROUPCODE)]);

    try {
        reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY_AQMDC, objLogInfo, function (pErr, pResult) {
            if (pErr) {
                callbackmain("Error on AQM DESIGNER CALL Function");
            } else {
                var AQMDC = pResult.rows;
                async.forEachOf(AQMDC, function (value, key, callback) {
                    if (GENIUS === "Y") {
                        async.series([
                            function (callbackasync) {
                                try {
                                    var PARSED_QUERY_AQM_WFTPA_DC = vsprintf(QUERY_AQM_WFTPA_DC, [addSingleQuote(AQMDC[key]["app_id"]), addSingleQuote(AQMDC[key]["wftpa_id"]), addSingleQuote(AQMDC[key]["group_code"]), addSingleQuote(AQMDC[key]["category"])]);

                                    reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY_AQM_WFTPA_DC, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            console.log("ERROR" + pErr.toString());
                                            callbackasync();
                                        } else {
                                            AQM_WFTPA_DC = pResult.rows;
                                            callbackasync();
                                        }
                                    });

                                } catch (ex) {
                                    callbackasync();
                                }
                            },
                            function (callbackasync) {
                                DeleteAQMdc(mDevCas, AQM_WFTPA_DC, headers, function () {
                                    callbackasync()
                                })
                            },
                            function (callbackasync) {
                                try {
                                    var PARSED_QUERY_AQM_WFTPA_DC2 = vsprintf(QUERY_AQM_WFTPA_DC2, [addSingleQuote(AQMDC[key]["app_id"]), addSingleQuote(AQMDC[key]["wftpa_id"]), addSingleQuote(AQMDC[key]["wftpa_id"])]);
                                    reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY_AQM_WFTPA_DC2, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            console.log("ERROR" + pErr.toString());
                                            callbackasync();
                                        } else {
                                            AQM_WFTPA_DC = pResult.rows;
                                            callbackasync();
                                        }
                                    });
                                } catch (ex) {
                                    callbackasync();
                                }
                            },
                            function (callbackasync) {
                                DeleteAQMdc(mDevCas, AQM_WFTPA_DC, headers, function () {
                                    callbackasync()
                                })
                            },
                            function (callbackasync) {
                                try {
                                    var PARSED_QUERY_AQM_WFTPA_DEL1 = vsprintf(QUERY_AQM_WFTPA_DEL1, [addSingleQuote(AQMDC[key]["app_id"]), addSingleQuote(AQMDC[key]["wftpa_id"]), addSingleQuote(AQMDC[key]["group_code"]), AQMDC[key]["category"]]);
                                    reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY_AQM_WFTPA_DEL1, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            callbackasync()
                                        } else {
                                            callbackasync();
                                        }
                                    });
                                } catch (ex) {
                                    callbackasync();
                                }
                            },
                            function (callbackasync) {
                                try {
                                    var PARSED_QUERY_AQM_WFTPA_DEL2 = vsprintf(QUERY_AQM_WFTPA_DEL2, [addSingleQuote(AQMDC[key]["app_id"]), addSingleQuote(AQMDC[key]["wftpa_id"]), addSingleQuote(AQMDC[key]["wftpa_id"])])
                                    reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY_AQM_WFTPA_DEL2, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            callbackasync()
                                        } else {
                                            callbackasync();
                                        }
                                    });
                                } catch (ex) {
                                    callbackasync();
                                }
                            }
                        ], function (err) {
                            callbackmain();
                        })

                    } else {
                        async.series([
                            function (callbackasync) {
                                try {
                                    var PARSED_QUERY_AQM_WFTPA_DC2 = vsprintf(QUERY_AQM_WFTPA_DC2, [addSingleQuote(AQMDC[key]["app_id"]), addSingleQuote(AQMDC[key]["wftpa_id"]), addSingleQuote(AQMDC[key]["wftpa_id"])]);
                                    reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY_AQM_WFTPA_DC2, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            callbackasync()
                                        } else {
                                            AQM_WFTPA_DC = pResult.rows;
                                            callbackasync();
                                        }
                                    });
                                } catch (ex) {
                                    callbackmain("Exception : " + ex.toString());
                                }
                            },
                            function (callbackasync) {
                                DeleteAQMdc(mDevCas, AQM_WFTPA_DC, headers, function () {
                                    callbackasync()
                                })
                            },
                            function (callbackasync) {
                                try {
                                    var PARSED_QUERY_AQM_WFTPA_DEL2 = vsprintf(QUERY_AQM_WFTPA_DEL2, [addSingleQuote(AQMDC[key]["app_id"]), addSingleQuote(AQMDC[key]["wftpa_id"]), addSingleQuote(AQMDC[key]["wftpa_id"])]);
                                    reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY_AQM_WFTPA_DEL2, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            console.log("ERROR" + pErr.toString());
                                            callbackasync()
                                        } else {
                                            callbackasync();
                                        }
                                    });
                                } catch (ex) {
                                    callbackmain("Exception : " + ex.toString());
                                }
                            }
                        ], function (err) {
                            callbackmain();
                        })
                    }
                },
                    function (err) {
                        if (err) console.error(err.message);
                        callbackmain();
                    });
            }
        });
    } catch (ex) {
        callbackmain("Exception : " + ex.toString());
    }
}


function DeleteAQMdc(mDevCas, AQM_WFTPA_DC, pClient_id, pHeaders, callbackmain) {
    headers = pHeaders;
    async.forEachOf(AQM_WFTPA_DC, function (value, key, callback) {
        var query = "delete from aqm_designer_changes where client_id=%s and code =%s and app_id=%s and category=%s and group_code=%s";
        var PARSED_QUERY = vsprintf(query, [addSingleQuote(AQM_WFTPA_DC[key]["code"]), addSingleQuote(AQM_WFTPA_DC[key]["app_id"]), addSingleQuote(AQM_WFTPA_DC[key]["category"]), addSingleQuote(AQM_WFTPA_DC[key]["group_code"])]);
        try {
            reqFXDBInstance.ExecuteQuery(mDevCas, PARSED_QUERY, objLogInfo, function (pErr, pResult) {
                if (pErr) {
                    console.log("ERROR" + pErr.toString());
                }
                console.log("Deleted from aqm designer changes")
            });
        } catch (ex) {
            callback();
        }
        callback();
    },
        function (err) {
            console.log("ERROR" + err);
            callbackmain();
        });
}

function addSingleQuote(data) {
    if (data !== null) {
        if (data.indexOf("'") > -1) {
            data = data.replaceAll("'", "''")
        }
        return "'" + data + "'";
    }
    else {
        return null;
    }
}

function dateString(date) {
    if (date !== null) {
        var myDate = new Date(date);
        hour = myDate.getHours();
        minute = myDate.getMinutes();
        second = myDate.getSeconds();
        // return "'" + myDate.getFullYear() + "-" + (myDate.getMonth() + 1) + "-" + myDate.getDate() + " " + hour + ":" + minute + ":" +second + "'";
        return "'" + reqDateFormatter.ConvertDate("'" + myDate + "'", headers, true) + "'";
    }
    else {
        return null;
    }
}

module.exports = {
    AQMdesignersave: AQMdesignersave,
    AQMardesignersave: AQMardesignersave,
    AQMModification: AQMModification,
    AQMlocking: AQMlocking
}