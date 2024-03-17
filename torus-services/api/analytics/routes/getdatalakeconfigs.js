/****
 * Api_Name          : /getdatalakeconfigs,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var CryptoJS 	   = require(modPath + "crypto-js");
var AES 	   = require(modPath + "crypto-js/aes");

// Initialize Global variables
var strResult = '';
var strMessage = '';
var secretkey = 'torusanlytics123';

var router = express.Router();

// Host the login api
router.post('/getdatalakeconfigs', function (appReq, appResp) {
  reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'getdatalakeconfigs-Analytics';
    objLogInfo.ACTION = 'getdatalakeconfigs';
    var strHeader = {};

    if (appReq.headers && appReq.headers.routingkey) {
      strHeader = appReq.headers;
      strHeader.routingkey = "CLT-0~APP-0~TNT-0~ENV-0";
    }
    else {
      strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
    }

    var qry = "SELECT project_id, redis_key, user_id FROM project_connections where project_id = " + appReq.body.prjct_id + " and user_id = " + appReq.body.usr_id + " and (project_connections.redis_key LIKE '%rdbms_%' or project_connections.redis_key LIKE '%cassandra_%') ;"

    try {
      reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
        reqTranDBInstance.ExecuteSQLQuery(pSession, qry, objLogInfo, function callback(res, err) {
          if (err) {
            _SendResponse({}, 'ERR-ANL-111105', 'Error selecting datalake from project_connections Table', err, null);
          }
          else {
            if (res.rows != null) {
              var temparry = [];
              var rediscount = 0;
              for (var i = 0; i < res.rows.length; i++) {
                reqInsHelper.GetConfig(res.rows[i].redis_key, function callback(pResult, pError) {
                  if (pError) {
                    _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_connections Table', pError, null,objLogInfo);
                    return
                  }
                  else {
                    temparry.push(JSON.parse(pResult));
                    if (rediscount == res.rows.length - 1) {
                      var dluischema = [];
                      var counter = 0;
                      temparry.forEach((item, j, array) => {
                        if ((temparry[j].database_mode == 1) || (temparry[j].database_mode == 2)) {
                          var dlschema = dluischemadefiner(temparry[j].engine, temparry[j].databasename, temparry[j].connectionip, temparry[j].port, temparry[j].username, temparry[j].passwordd);
                          dluischema.push(dlschema);
                          console.log(counter, j, temparry[j].database_mode, temparry[j].engine)
                          counter++;
                          if (counter == temparry.length) {
                            _SendResponse(JSON.stringify({ status: 'success', data: dluischema }), '', '', null, null,objLogInfo)
                          }
                        }
                        else {
                          console.log(counter, j, temparry[j].database_mode, temparry[j].engine)
                          counter++;
                          if (counter == temparry.length) {
                            _SendResponse(JSON.stringify({ status: 'success', data: dluischema }), '', '', null, null,objLogInfo)
                          }
                        }
                      });
                    }
                    rediscount++
                  }
                })
              }
            }
            else {
              _SendResponse(JSON.stringify({ status: "failed to fetch data" }), '', '', null, null)
            }
          }
        })
      })
    }
    catch (error) {
      errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error);
    }
  });
  // To send the app response
  function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
    var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
    var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
    return reqInsHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
  }

  function errorHandler(errcode, message) {
    console.log(errcode, message);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
  }

  function dluischemadefiner(dserver, ddbname, ddbip, ddbport, ddbuser, ddbpsswrd) {
    try {
      var dlschema = [];
      if (dserver == "mysql") {
        var conn_url = "jdbc:mysql://" + ddbip.trim() + ":" + ddbport + "/" + ddbname.trim() + "?user=" + ddbuser.trim() + "&" + "password=" + ddbpsswrd.trim();
        var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
        encrypted_conn_url = encrypted_conn_url.toString();
        dlschema.push(
          {
            "label": dserver.trim() + "(" + ddbip.trim() + ")",
            "field": "database",
            "expandedIcon": "fa-folder-open",
            "collapsedIcon": "fa-folder",
            "conn_detail": encrypted_conn_url,
            "children": [
              {
                "label": ddbname.trim(), "field": "databasename", "expandedIcon": "fa-folder-open", "collapsedIcon": "fa-folder"
              }]
          });
      }
      if (dserver == "postgres") {
        var conn_url = "jdbc:postgresql://" + ddbip.trim() + ":" + ddbport + "/" + ddbname.trim() + "?user=" + ddbuser.trim() + "&" + "password=" + ddbpsswrd.trim();
        var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
        encrypted_conn_url = encrypted_conn_url.toString();
        dlschema.push(
          {
            "label": dserver.trim() + "(" + ddbip.trim() + ")",
            "field": "database",
            "expandedIcon": "fa-folder-open",
            "collapsedIcon": "fa-folder",
            "conn_detail": encrypted_conn_url,
            "children": [
              {
                "label": ddbname.trim(), "field": "databasename", "expandedIcon": "fa-folder-open", "collapsedIcon": "fa-folder"
              }]
          });
      }
      if (dserver == "sqlserver") {
        var conn_url = "jdbc:sqlserver://" + ddbip.trim() + ":" + ddbport + ";database=" + ddbname.trim() + ";user=" + ddbuser.trim() + ";password=" + ddbpsswrd.trim();
        var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
        encrypted_conn_url = encrypted_conn_url.toString();
        dlschema.push(
          {
            "label": dserver.trim() + "(" + ddbip.trim() + ")",
            "field": "database",
            "expandedIcon": "fa-folder-open",
            "collapsedIcon": "fa-folder",
            "conn_detail": encrypted_conn_url,
            "children": [
              {
                "label": ddbname.trim(), "field": "databasename", "expandedIcon": "fa-folder-open", "collapsedIcon": "fa-folder"
              }]
          });
      }
      if (dserver == "oracle") {
        var conn_url = "jdbc:oracle:thin:" + ddbuser.trim() + "/" + ddbpsswrd.trim() + "@//" + ddbip.trim() + ":" + ddbport + "/" + ddbname.trim();
        var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
        encrypted_conn_url = encrypted_conn_url.toString();
        dlschema.push(
          {
            "label": dserver.trim() + "(" + ddbip.trim() + ")",
            "field": "database",
            "expandedIcon": "fa-folder-open",
            "collapsedIcon": "fa-folder",
            "conn_detail": encrypted_conn_url,
            "children": [
              {
                "label": ddbname.trim(), "field": "databasename", "expandedIcon": "fa-folder-open", "collapsedIcon": "fa-folder"
              }]
          });
      }


      if (dserver == "cassandra") {
        var conn_url = "cdbc:cassandra://" + ddbip.trim() + ":" + ddbport + "/" + ddbname.trim() + "?user=" + ddbuser.trim() + "&" + "password=" + ddbpsswrd.trim();
        //console.log(conn_url);
        var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
        encrypted_conn_url = encrypted_conn_url.toString();
        dlschema.push(
          {
            "label": dserver.trim() + "(" + ddbip.trim() + ")",
            "field": "database",
            "expandedIcon": "fa-folder-open",
            "collapsedIcon": "fa-folder",
            "conn_detail": encrypted_conn_url,
            "children": [
              {
                "label": ddbname.trim(), "field": "databasename", "expandedIcon": "fa-folder-open", "collapsedIcon": "fa-folder"
              }]
          });
      }
      return (dlschema[0]);
    }
    catch (error) {
      return (error);
    }
  }
});
module.exports = router;
