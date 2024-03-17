/****
 * Api_Name          : /getdatasourceconfigs,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/';
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var knex = require(modPath + 'knex');
var pgclient = require(modPath + 'pg')
var mysql 	   = require(modPath + 'mysql');
var mssql            = require(modPath + "mssql");
var oracledb       = require(modPath + 'oracledb');
var cassandra      = require(modPath + 'cassandra-driver');
var CryptoJS 	   = require(modPath + "crypto-js");
var AES 	   = require(modPath + "crypto-js/aes");

// Initialize Global variables
var strResult = '';
var strMessage = '';
var secretkey = 'torusanlytics123';

var router = express.Router();

// Host the login api
router.post('/getdatasourceconfigs', function (appReq, appResp) {

  reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
  reqLogWriter.Eventinsert(objLogInfo);
  objLogInfo.PROCESS = 'getdatasourceconfigs-Analytics';
  objLogInfo.ACTION = 'getdatasourceconfigs';
  var strHeader = {};

  if (appReq.headers) {
    strHeader = appReq.headers;
    strHeader.routingkey = "CLT-0~APP-0~TNT-0~ENV-0";
  }
  else {
    strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
  }

  var connresult = [];
  var qry = "SELECT project_id, redis_key, user_id FROM project_connections where project_id = " + appReq.body.prjct_id + " and user_id = " + appReq.body.usr_id + " and (project_connections.redis_key LIKE '%rdbms_%' or project_connections.redis_key LIKE '%cassandra_%');"
  try {
    reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
      reqTranDBInstance.ExecuteSQLQuery(pSession, qry, objLogInfo, function callback(res, err) {
        if (err) {
          _SendResponse({}, 'ERR-ANL-111105', 'Error selecting datasource from project_connections Table', err, null,objLogInfo);
        }
        else {
          if (res.rows != null) {
            var temparry = [];
            var rediscont = 0;
            for (var i = 0; i < res.rows.length; i++) {
              reqInsHelper.GetConfig(res.rows[i].redis_key,function callback(pResult, pError) {
                if (pError) {
                  _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_connections Table', pError, null,objLogInfo);
                  return
                }
                else {
                  temparry.push(JSON.parse(pResult));
                  console.log(i, rediscont);
                  if (rediscont == res.rows.length - 1) {
                    var schemacounter = 0;
                    temparry.forEach((item, j, array) => {
                      if ((temparry[j].database_mode == 0) || (temparry[j].database_mode == 2)) {
                        newconngetschema(temparry[j].connectionname, temparry[j].connectionip, temparry[j].port, temparry[j].engine, temparry[j].databasename, temparry[j].username, temparry[j].password)
                          .then(function (pRes) {
                            console.log("loop count:" + schemacounter, temparry[j].database_mode, temparry[j].engine)
                            connresult.push(pRes[0]);
                            console.log(schemacounter, j, temparry.length, connresult.length);
                            schemacounter++
                            if (schemacounter == temparry.length) {
                              _SendResponse(JSON.stringify({ status: 'success', data: connresult }), '', '', null, null,objLogInfo)
                            }
                          },
                            function (pErr) {
                              schemacounter++
                              console.log(pErr);
                              if (schemacounter == temparry.length) {
                                _SendResponse(JSON.stringify({ status: 'partialschema', data: connresult }), '', '', null, null,objLogInfo)
                              }
                              //_SendResponse({}, 'ERR-ANL-111105', 'Error in schema creation for query editor', pErr, null,objLogInfo)
                            }
                          )
                      }
                      else {
                        console.log("loop count:" + schemacounter, temparry[j].database_mode, temparry[j].engine)
                        schemacounter++;
                        if (schemacounter == temparry.length) {
                          _SendResponse(JSON.stringify({ status: 'success', data: connresult }), '', '', null, null,objLogInfo)
                        }
                      }
                    });
                  }
                  rediscont++
                }
              })
            }
          }
          else {
            _SendResponse(JSON.stringify({status: "failed to fetch data"}), '', '', null, null,objLogInfo)
          }
        }
      })
    })
  } catch (error) {
    errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error)
  }
});
    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pObjLoginfo) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInsHelper.SendResponse('Analyticsdatasource', appResp, ResponseData, pObjLoginfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
    }
    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }

    function newconngetschema(connname,connip,connport,connengine,conndbname,connusrname,connpswrd){
      return new Promise(function(resolve,reject){
        try{
        var connarry = [];
        if(connengine == "postgres"){
          //console.log(connengine);
          var client = new pgclient.Client({
              user: connusrname,
              host: connip,
              database: conndbname,
              password: connpswrd,
              port: connport,
            })
          var conn_url = "jdbc:postgresql://"+connip+":"+connport+"/"+conndbname+"?user="+connusrname+"&"+"password="+connpswrd+"&currentSchema=public";
          var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
          encrypted_conn_url = encrypted_conn_url.toString();
          console.log(encrypted_conn_url);
          connarry.push({conn_url:encrypted_conn_url,connschema:null,conn_name:connname});
          client.connect((err) => {
            if(err) {
              console.log("error "+ err);
              reject(err)
            }
            var query = "SELECT TABLE_SCHEMA ,TABLE_NAME ,COLUMN_NAME ,DATA_TYPE  FROM  INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'public';"
            client.query(query, (err, res) => {
              if (err){
                client.end()
                reject(err);
              }
               if (res.rows != null) {
                 uischeamadefiner(res.rows,connname,connengine,conndbname).then(function(res){
                   connarry[0].connschema = res;
                   client.end();
                   //console.log(JSON.stringify(res));
                   resolve(connarry);
                 });
                 }
               else {
                 resolve("return null row");
                 }
            })
          })
        }
        if (connengine == "mysql"){
          //console.log(connengine);
            var mysqlclient = {
              user: connusrname,
              password: connpswrd,
              host: connip,
              port: connport,
              database: conndbname
            }
            var conn_url = "jdbc:mysql://"+connip+":"+connport+"/"+conndbname+"?user="+connusrname+"&"+"password="+connpswrd ;
            var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
            encrypted_conn_url = encrypted_conn_url.toString();
            //console.log(encrypted_conn_url);
            connarry.push({conn_url:encrypted_conn_url,connschema:null,conn_name:connname});
            var con = mysql.createConnection(mysqlclient);
            var query = "SELECT TABLE_SCHEMA ,TABLE_NAME ,COLUMN_NAME ,DATA_TYPE  FROM  INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '"+conndbname+"';"
            con.query(query, (err, rows) => {
              if (err){
                con.end();
                reject(err);
              }
               if (rows != null) {
                 uischeamadefiner(rows,connname,connengine,conndbname).then(function(res){
                   connarry[0].connschema = res;
                   con.end();
                   resolve(connarry);
                 });
                 }
               else {
                 con.end();
                 resolve("return null row");
                 }
            })
        }
        if (connengine == "sqlserver"){
            var mssqlclient = {
              user: connusrname,
              password: connpswrd,
              server: connip,
              port: connport,
              database: conndbname
            }
            var conn_url = "jdbc:sqlserver://"+connip+":"+connport+";database="+conndbname+";user="+connusrname+";password="+connpswrd ;
            var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
            encrypted_conn_url = encrypted_conn_url.toString();
            //console.log(encrypted_conn_url);
            connarry.push({conn_url:encrypted_conn_url,connschema:null,conn_name:connname});
            var qry = "SELECT TABLE_SCHEMA ,TABLE_NAME ,COLUMN_NAME ,DATA_TYPE  FROM  INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo';"
            mssql.close()
            mssql.connect(mssqlclient, function (err) {
                if (err){
                  reject(err);
                  console.log(err);
                }
                var request = new mssql.Request();
                request.query(qry, function (err, rows) {
                  if (err){
                    reject(err);
                    console.log(err);
                  }
                  if(rows!=null){
                     uischeamadefiner(rows.recordset,connname,connengine,conndbname).then(function(res){
                       connarry[0].connschema = res;
                       //console.log(JSON.stringify(res));
                       resolve(connarry);
                     });
                  }
                  else {
                      resolve("return null row");
                    }
                });
            });
        }
        if (connengine == "oracle"){
          //console.log(connengine);
            var oracleclient = {
              user: connusrname,
              password: connpswrd,
              connectString: connip+":"+connport+"/"+conndbname
            }
            var conn_url = "jdbc:oracle:thin:"+connusrname+"/"+connpswrd+"@//"+connip+":"+connport+"/"+conndbname;
            var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
            encrypted_conn_url = encrypted_conn_url.toString();
            //console.log(encrypted_conn_url);
            connarry.push({conn_url:encrypted_conn_url,connschema:null,conn_name:connname});
            var qry = "SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE FROM user_tab_columns"
            oracledb.getConnection(oracleclient,function(err, connection)
              {
                if (err) {
                   console.error(err);
                   reject(err);
                  }
                connection.execute(qry,function(err, result)
                  {
                    if (err) {
                      console.error(err);
                      connection.close();
                      reject(err);
                    }
                          if(result.rows!=null){
                             uischeamadefiner(result.rows,connname,connengine,conndbname).then(function(res){
                               connarry[0].connschema = res;
                               connection.close();
                               //console.log(JSON.stringify(res));
                               resolve(connarry);
                             });
                          }
                          else {
                              connection.close();
                              resolve("return null row");
                            }
                  });
              });
            }
            if(connengine == "cassandra"){
                var cassclient = new cassandra.Client({
                  contactPoints: [ connip ],
                  keyspace: conndbname,
                  authProvider: new cassandra.auth.PlainTextAuthProvider(connusrname,connpswrd),
                  protocolOptions: {port: connport}
                });
                var conn_url = "cdbc:cassandra://"+connip+":"+connport+"/"+conndbname+"?user="+connusrname+"&"+"password="+connpswrd ;
                var encrypted_conn_url = CryptoJS.AES.encrypt(conn_url, secretkey);
                encrypted_conn_url = encrypted_conn_url.toString();
                //console.log(encrypted_conn_url);
                connarry.push({conn_url:encrypted_conn_url,connschema:null,conn_name:connname});
                var qry = 'select keyspace_name,columnfamily_name,column_name from system.schema_columns where keyspace_name = ?';
                var params =  [ conndbname ];
                cassclient.execute(qry,params,function(err,result){
                    if(err){
                      console.log(err);
                      cassclient.shutdown(function(err,res){
                        if(err)console.log('cass client not shutdowned properly');
                        console.log('cass client closed');
                      })
                      reject(err);
                    }
                    else{
                      if(result.rows!=null){
                        uischeamadefiner(result.rows,connname,connengine,conndbname).then(function(res){
                          connarry[0].connschema = res;
                          cassclient.shutdown(function(err,res){
                           if(err)console.log('cass client not shutdowned properly');
                           console.log('cass client closed');
                         })
                          //console.log(JSON.stringify(res));
                          resolve(connarry);
                        });
                     }
                     else {
                       cassclient.shutdown(function(err,res){
                         if(err)console.log('cass client not shutdowned properly');
                         console.log('cass client closed');
                       })
                         resolve("return null row");
                       }
                    }
                })
            }
          }
          catch(error){
            reject(error);
          }
      })
    }
    function uischeamadefiner(param,connname,connengine,conndbname){
      return new Promise(function(resolve,reject){
      //console.log(param);
      var uischema = [];
      var groups = {};
      uischema.push({ "label":null,"field":"database","expandedIcon":"fa-folder-open","collapsedIcon":"fa-folder",
         "children":[
            {
               "label":null,"field":"schema","expandedIcon":"fa-folder-open","collapsedIcon":"fa-folder",
               "children":[]}]});

            if(connengine == "postgres" ){
              for (var i = 0; i < param.length; i++) {
                var groupName = param[i].table_name;
                if (!groups[groupName]) {
                  groups[groupName] = [];
                }
                groups[groupName].push(param[i]);
              }
                var myArray = [];
                for (var groupName in groups) {
                  myArray.push({group: groupName, entities: groups[groupName]});
                }
                //console.log(JSON.stringify(myArray));

              for(i=0;i<myArray.length;i++){
                uischema[0].children[0].children.push({
                                 "label":myArray[i].group,"icon":"fa fa-window-maximize","field":"table",
                                 "children":[]});
                  }
                  //console.log(JSON.stringify(uischema));

              for(i=0;i<myArray.length;i++){
                for(j=0;j<myArray[i].entities.length;j++){
                  uischema[0].children[0].children[i].children.push({
                     "label":myArray[i].entities[j].column_name,
                     "icon":"fa fa-window-maximize",
                     "field":"column"
                  })
                }
              }
              uischema[0].label = "Postgres("+connname+")";
              uischema[0].children[0].label = "public";
              //console.log(JSON.stringify(uischema));
              resolve(uischema);
            }
            if(connengine == "mysql" ){
              for (var i = 0; i < param.length; i++) {
                var groupName = param[i].TABLE_NAME;
                if (!groups[groupName]) {
                  groups[groupName] = [];
                }
                groups[groupName].push(param[i]);
              }
                var myArray = [];
                for (var groupName in groups) {
                  myArray.push({group: groupName, entities: groups[groupName]});
                }
                //console.log(JSON.stringify(myArray));

              for(i=0;i<myArray.length;i++){
                uischema[0].children[0].children.push({
                                 "label":myArray[i].group,"icon":"fa fa-window-maximize","field":"table",
                                 "children":[]});
                  }
                  //console.log(JSON.stringify(uischema));

              for(i=0;i<myArray.length;i++){
                for(j=0;j<myArray[i].entities.length;j++){
                  uischema[0].children[0].children[i].children.push({
                     "label":myArray[i].entities[j].COLUMN_NAME,
                     "icon":"fa fa-window-maximize",
                     "field":"column"
                  })
                  //console.log(myArray[i].group,myArray[i].entities[j].column_name);
                }
              }
              uischema[0].label = "Mysql("+connname+")";
              uischema[0].children[0].label = conndbname;
              //console.log(JSON.stringify(uischema));
              resolve(uischema);
            }
            if(connengine == "sqlserver" ){
              for (var i = 0; i < param.length; i++) {
                var groupName = param[i].TABLE_NAME;
                if (!groups[groupName]) {
                  groups[groupName] = [];
                }
                groups[groupName].push(param[i]);
              }
                var myArray = [];
                for (var groupName in groups) {
                  myArray.push({group: groupName, entities: groups[groupName]});
                }
                //console.log(JSON.stringify(myArray));

              for(i=0;i<myArray.length;i++){
                uischema[0].children[0].children.push({
                                 "label":myArray[i].group,"icon":"fa fa-window-maximize","field":"table",
                                 "children":[]});
                  }
                  //console.log(JSON.stringify(uischema));

              for(i=0;i<myArray.length;i++){
                for(j=0;j<myArray[i].entities.length;j++){
                  uischema[0].children[0].children[i].children.push({
                     "label":myArray[i].entities[j].COLUMN_NAME,
                     "icon":"fa fa-window-maximize",
                     "field":"column"
                  })
                  //console.log(myArray[i].group,myArray[i].entities[j].column_name);
                }
              }
              uischema[0].label = "MSsql("+connname+")";
              uischema[0].children[0].label = conndbname;
              //console.log(JSON.stringify(uischema));
              resolve(uischema);
            }
            if(connengine == "oracle" ){
              for (var i = 0; i < param.length; i++) {
                var groupName = param[i][0];
                if (!groups[groupName]) {
                  groups[groupName] = [];
                }
                groups[groupName].push(param[i]);
              }
                var myArray = [];
                for (var groupName in groups) {
                  myArray.push({group: groupName, entities: groups[groupName]});
                }
                //console.log(JSON.stringify(myArray));

              for(i=0;i<myArray.length;i++){
                uischema[0].children[0].children.push({
                                 "label":myArray[i].group,"icon":"fa fa-window-maximize","field":"table",
                                 "children":[]});
                  }
                  //console.log(JSON.stringify(uischema));

              for(i=0;i<myArray.length;i++){
                for(j=0;j<myArray[i].entities.length;j++){
                  uischema[0].children[0].children[i].children.push({
                     "label":myArray[i].entities[j][1],
                     "icon":"fa fa-window-maximize",
                     "field":"column"
                  })
                  //console.log(myArray[i].group,myArray[i].entities[j].column_name);
                }
              }
              uischema[0].label = "Oracle("+connname+")";
              uischema[0].children[0].label = conndbname;
              resolve(uischema);
            }
            if(connengine == "cassandra" ){
              for (var i = 0; i < param.length; i++) {
                var groupName = param[i].columnfamily_name;
                if (!groups[groupName]) {
                  groups[groupName] = [];
                }
                groups[groupName].push(param[i]);
              }
                var myArray = [];
                for (var groupName in groups) {
                  myArray.push({group: groupName, entities: groups[groupName]});
                }
                //console.log(JSON.stringify(myArray));

              for(i=0;i<myArray.length;i++){
                uischema[0].children[0].children.push({
                                 "label":myArray[i].group,"icon":"fa fa-window-maximize","field":"table",
                                 "children":[]});
                  }
                  //console.log(JSON.stringify(uischema));

              for(i=0;i<myArray.length;i++){
                for(j=0;j<myArray[i].entities.length;j++){
                  uischema[0].children[0].children[i].children.push({
                     "label":myArray[i].entities[j].column_name,
                     "icon":"fa fa-window-maximize",
                     "field":"column"
                  })
                  //console.log(myArray[i].group,myArray[i].entities[j].column_name);
                }
              }
              uischema[0].label = "Cassandra("+connname+")";
              uischema[0].children[0].label = conndbname;
              resolve(uischema);
            }
      })
    }
});
module.exports = router;
