/*
  @Decsription: To get procedure parameters,
  @Last Error Code : 'undefined' 
*/

// Require dependencies
var oracledb = require('oracledb');
var mysql = require('mysql');
var reqDBInstance = require('../DBInstance');

var direction = { BIND_IN: 3001, BIND_INOUT: 3002, BIND_OUT: 3003 };
var type = { DEFAULT: 0, DB_TYPE_VARCHAR: 2001, DB_TYPE_NUMBER: 2010, DB_TYPE_DATE: 2011, DB_TYPE_RAW: 2006, DB_TYPE_CHAR: 2003, DB_TYPE_BINARY_FLOAT: 2007, DB_TYPE_BINARY_DOUBLE: 2008, DB_TYPE_ROWID: 2005, DB_TYPE_CLOB: 2017, DB_TYPE_BLOB: 2019, DB_TYPE_TIMESTAMP: 2012, DB_TYPE_TIMESTAMP_TZ: 2013, DB_TYPE_TIMESTAMP_LTZ: 2014, STRING: 2001, NUMBER: 2010, DATE: 2014, CURSOR: 2021, BUFFER: 2006, CLOB: 2017, BLOB: 2019, ARRAY: 4001, OBJECT: 4002 };


var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
var databaseName = 'oracledb';
if (serviceModel.TRANDB == "ORACLE") {
    databaseName = 'oracledb';
} else if (serviceModel.TRANDB == "MYSQL") {
    databaseName = 'mysql';
}
var objKeys = Object.keys(eval(databaseName));
var dir = Object.keys(direction);
var typ = Object.keys(type);
for (var i = 0; i < objKeys.length; i++) {
    var currKey = objKeys[i];
    if (dir.indexOf(currKey) != -1) {
        direction[currKey] = eval(databaseName)[currKey];
    }
    if (typ.indexOf(currKey) != -1) {
        type[currKey] = eval(databaseName)[currKey];
    }
}

module.exports = {
    direction: direction,
    type: type
};

/************ End of File ************/