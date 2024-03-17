var rootpath = "../../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var constants = require('../util/message');

//global variable
var pHeaders = "";
var mDevCas = "";


function updateandGetCounter(mDevCas, cas_type, code, callback) {
    var QUERY_UPDATE_COUNTER = "UPDATE fx_total_items SET COUNTER_VALUE = COUNTER_VALUE + 1 WHERE CODE = ?"
    var QUERY_SELECT_COUNTER = "select COUNTER_VALUE from fx_total_items where CODE = ?"
        // Get cassandra instance
    if (cas_type === "dep_cas") {
        reqCasInstance.GetCassandraConn(pHeaders, "clt_cas", function (pClient) {
            pClient.execute(QUERY_UPDATE_COUNTER, [code], function (pErr, pResult) {
                if (!pErr) {
                    pClient.execute(QUERY_SELECT_COUNTER, [code], function (pErr1, pResult1) {
                        if (!pErr) {
                            callback(constants.SUCCESS, pResult1.rows[0]["counter_value"]["low"]);
                        } else {
                            callback(constants.FAILURE, pErr1.message);
                        }
                    });
                } else {
                    callback(constants.FAILURE, pErr.message);
                }
            });
        });
    } else {
        mDevCas.execute(QUERY_UPDATE_COUNTER, [code], function (pErr, pResult) {
            if (!pErr) {
                mDevCas.execute(QUERY_SELECT_COUNTER, [code], function (pErr1, pResult1) {
                    if (!pErr) {
                        callback(constants.SUCCESS, pResult1.rows[0]["counter_value"]["low"]);
                    } else {
                        callback(constants.FAILURE, pErr1.message);
                    }
                });
            } else {
                callback(constants.FAILURE, pErr.message);
            }
        });
    }
}






module.exports = {
    UpdateandGetCounterValue: updateandGetCounter
}