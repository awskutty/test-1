/*
  @Decsription: To convert date to oracle or postgres format based on Service model setup in redis
  fxAuditColumn new function added
*/

// Require dependencies
var reqMoment = require('moment');
var reqInstanceHelper = require('../InstanceHelper');
var reqMomentTimezone = require('moment-timezone');
var strDbType = '';
var mDbTypeSessionValues = {};
var connStr = 'DB_TYPE';
var serviceName = 'DateFormatter';

// To get the current date time 
function GetCurrentDate(pHeaders, isFxDb) {
    var appDbType = getDbTypeFromHeaders(pHeaders);
    if (!appDbType) {
        appDbType = strDbType;
    }
    var reqDBInstance = require('../../instance/DBInstance');
    var Service_Model = reqDBInstance.DBInstanceSession.SERVICE_MODEL;
    if (Service_Model.TYPE == 'ULTIMATE' && isFxDb) {
        // It always goes to Cassandra.
        return reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
    } else {
        if (appDbType != null && appDbType != undefined && appDbType.toLowerCase() == 'oracle') {
            return reqMoment(new Date()).format('DD-MMM-YYYY hh:mm:ss A');
        } else {
            return reqMoment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSSS');
        }
    }
}


// Retrun crrent date depends on UTC mode
function GetCurrentDateInUTC(pHeaders, pLogInfo) {
    try {
        var appDbType = getDbTypeFromHeaders(pHeaders);
        var dateFormat;
        if (!appDbType) {
            appDbType = strDbType;
        }
        if (appDbType && appDbType.toLowerCase() == 'oracle') {
            dateFormat = 'DD-MMM-YYYY hh.mm.ss.SSSSSS A';
        } else {
            dateFormat = 'YYYY-MM-DD HH:mm:ss.SSSS';
        }
        return reqMoment.utc().format(dateFormat); // UTC [Without TimeZone]
    } catch (error) {
        console.log(error);
    }
}

// OutPut will be new Date() with Tenant Timezone [example Nairobi]
function GetTenantCurrentDateTime(pHeaders, pLogInfo, pDateFormat) {
    try {
        var timezoneInfo = pLogInfo.TIMEZONE_INFO || {};
        var appDbType = getDbTypeFromHeaders(pHeaders);
        var dateFormat;
        if (!appDbType) {
            appDbType = strDbType;
        }
        if (appDbType && appDbType.toLowerCase() == 'oracle') {
            dateFormat = 'DD-MMM-YYYY hh.mm.ss.SSSSSS A';
        } else {
            dateFormat = 'YYYY-MM-DD HH:mm:ss.SSSS';
        }
        if (pDateFormat) {
            dateFormat = pDateFormat;
        }
        return reqMomentTimezone.tz(new Date(), timezoneInfo.timezone_name).format(dateFormat);

    } catch (error) {
        console.log(error);
    }
}


// OutPut will be new Date() with Tenant Timezone [example Nairobi] without format 
// Sample result : "2021-07-20T10:01:48Z"
function GetTenantCurrentDateTimeWithoutformat(pHeaders, pLogInfo) {
    try {
        var timezoneInfo = pLogInfo.TIMEZONE_INFO || {};
        return reqMomentTimezone.tz(new Date(), timezoneInfo.timezone_name).format();
    } catch (error) {
        console.log(error);
    }
}

// OutPut will be new Date() with Time as 12AM
function GetTenantCurrentDate(pHeaders, pLogInfo) {
    try {
        var timezoneInfo = pLogInfo.TIMEZONE_INFO || {};
        var appDbType = getDbTypeFromHeaders(pHeaders);
        var dateFormat;
        if (!appDbType) {
            appDbType = strDbType;
        }
        if (appDbType && appDbType.toLowerCase() == 'oracle') {
            dateFormat = 'DD-MMM-YYYY 12.00.00.000000 A';
        } else {
            dateFormat = 'YYYY-MM-DD 00:00:00.000';
        }
        return reqMomentTimezone.tz(new Date(), timezoneInfo.timezone_name).format(dateFormat);

    } catch (error) {
        console.log(error);
    }
}

// OutPut will be Give Date with 12 AM Format
function GetDateAt12AM(pHeaders, pLogInfo, InputDate) {
    try {
        var appDbType = getDbTypeFromHeaders(pHeaders);
        var dateFormat;
        if (!appDbType) {
            appDbType = strDbType;
        }
        if (appDbType && appDbType.toLowerCase() == 'oracle') {
            dateFormat = 'DD-MMM-YYYY 12.00.00.000000 A';
        } else {
            dateFormat = 'YYYY-MM-DD 00:00:00.000';
        }
        return reqMoment(InputDate).format(dateFormat);

    } catch (error) {
        console.log(error);
    }
}


// OutPut will be Give Date with 12 AM Format based on Given Timezone
function GetDateAt12AMWithTenantTZ(pHeaders, pLogInfo, InputDate) {
    try {
        var timezoneInfo = pLogInfo.TIMEZONE_INFO;
        var appDbType = getDbTypeFromHeaders(pHeaders);
        var dateFormat;
        if (!appDbType) {
            appDbType = strDbType;
        }
        if (appDbType && appDbType.toLowerCase() == 'oracle') {
            dateFormat = 'DD-MMM-YYYY 12.00.00.000000 A';
        } else {
            dateFormat = 'YYYY-MM-DD 00:00:00.000';
        }
        return reqMomentTimezone.tz(InputDate, timezoneInfo.timezone_name).format(dateFormat);

    } catch (error) {
        console.log(error);
    }
}


//  convert Given Date  based on Given Timezone and format it
function GetDateTimeWithTenantTZ(pHeaders, pLogInfo, InputDate) {
    try {
        var timezoneInfo = pLogInfo.TIMEZONE_INFO || {};
        var appDbType = getDbTypeFromHeaders(pHeaders);
        var dateFormat;
        if (!appDbType) {
            appDbType = strDbType;
        }
        if (appDbType && appDbType.toLowerCase() == 'oracle') {
            dateFormat = 'DD-MMM-YYYY hh.mm.ss.SSSSSS A';
        } else {
            dateFormat = 'YYYY-MM-DD HH:mm:ss.SSSS';
        }
        console.log('GetDateTimeWithTenantTZ ' + reqMomentTimezone.tz(InputDate, timezoneInfo.timezone_name).format(dateFormat));
        console.log('timezoneInfo.timezone_name ' + timezoneInfo.timezone_name);
        return reqMomentTimezone.tz(InputDate, timezoneInfo.timezone_name).format(dateFormat);

    } catch (error) {
        console.log(error);
    }
}

function formatDateWithDBType(pHeaders, pLogInfo, InputDate) {
    var dateFormat;
    var appDbType = getDbTypeFromHeaders(pHeaders);
    if (!appDbType) {
        appDbType = strDbType;
    }
    if (appDbType && appDbType.toLowerCase() == 'oracle') {
        dateFormat = 'DD-MMM-YYYY hh.mm.ss.SSSSSS A';
    } else {
        dateFormat = 'YYYY-MM-DD HH:mm:ss.SSSS';
    }
    if (pLogInfo && pLogInfo.TIMEZONE_INFO && pLogInfo.TIMEZONE_INFO.utc_mode) {
        return reqMoment.parseZone(InputDate).utc(false).format(dateFormat);
    } else {
        return reqMoment(InputDate).format(dateFormat);
    }
}

// for UTC column
function GetSearchCriteriaForUTC(pHeaders, pLogInfo, ColumnName, FromDate, ToDate, optr) {
    try {

        if (!optr) {
            optr = '=';
        }
        if (ToDate) {
            optr = '>=';
        }

        if (pLogInfo && pLogInfo.TIMEZONE_INFO && pLogInfo.TIMEZONE_INFO.utc_mode) {
            //reqInstanceHelper.PrintInfo(serviceName, 'UTC Mode Is Enabled', pLogInfo);
            var UTCMode = pLogInfo.TIMEZONE_INFO.utc_mode;
            if (UTCMode.toLowerCase() == 'true') {
                var cond = `TO_DATE(TO_CHAR(${ColumnName}, 'DD-MON-YY hh:mi:ss PM'),'DD-MON-YY hh:mi:ss PM') ${optr} TO_DATE(TO_CHAR(cast('${formatDateWithDBType(pHeaders, pLogInfo, FromDate)}' as TIMESTAMP),'DD-MON-YY hh:mi:ss PM'), 'DD-MON-YY hh:mi:ss PM')`;
                if (ToDate) {
                    cond = `${cond} AND TO_DATE(TO_CHAR(${ColumnName}, 'DD-MON-YY hh:mi:ss PM'),'DD-MON-YY hh:mi:ss PM') <= TO_DATE(TO_CHAR(cast('${formatDateWithDBType(pHeaders, pLogInfo, ToDate)}' as TIMESTAMP),'DD-MON-YY hh:mi:ss PM'), 'DD-MON-YY hh:mi:ss PM')`;
                }
                return cond;
            } else {
                return GetSearchCriteriaForBusinessColumn(pHeaders, pLogInfo, ColumnName, FromDate, ToDate);
            }
        } else {
            //reqInstanceHelper.PrintInfo(serviceName, 'UTC Mode Information Is Not Found From ObjLogInfo', pLogInfo);
            return GetSearchCriteriaForBusinessColumn(pHeaders, pLogInfo, ColumnName, FromDate, ToDate);
        }

    } catch (error) {
        console.log(error);
    }
}



// (Date & DateTime)
function GetSearchCriteriaForBusinessColumn(pHeaders, pLogInfo, ColumnName, FromDate, ToDate, optr) {
    try {
        if (!optr) {
            optr = '=';
        }
        if (ToDate) {
            optr = '>=';
        }
        var cond = `TO_DATE(TO_CHAR(${ColumnName}, 'DD-MON-YY'),'DD-MON-YY') ${optr} TO_DATE(TO_CHAR(cast('${ConvertDate(FromDate.toString(), pHeaders)}' as TIMESTAMP),'DD-MON-YY'), 'DD-MON-YY')`;
        if (ToDate) {
            cond = `${cond} AND TO_DATE(TO_CHAR(${ColumnName}, 'DD-MON-YY'),'DD-MON-YY') <= TO_DATE(TO_CHAR(cast('${ConvertDate(ToDate.toString(), pHeaders)}' as TIMESTAMP),'DD-MON-YY'), 'DD-MON-YY')`;
        }
        return cond;
    } catch (error) {
        console.log(error);
    }
}





// To convert the given date to particular DB format based on ServiceModel 
// isFxDb - boolean
function ConvertDate(pDateString, pHeaders, isFxDb, formatString) {
    var appDbType = getDbTypeFromHeaders(pHeaders);
    if (!appDbType) {
        appDbType = strDbType;
    }
    var objDate;
    if (typeof pDateString == 'object') {
        objDate = pDateString;
    } else if (pDateString.indexOf('T') <= -1 && pDateString.indexOf('Z') <= -1) {
        objDate = new Date(new Date(pDateString).toISOString()); // this is for date without timezone
    } else {
        objDate = new Date(pDateString);
    }
    var reqDBInstance = require('../../instance/DBInstance');
    var Service_Model = reqDBInstance.DBInstanceSession.SERVICE_MODEL;
    if (Service_Model.TYPE == 'ULTIMATE' && isFxDb) {// It always goes to Cassandra.
        if (formatString) {
            return reqMoment(objDate).format(formatString);
        } else {
            return reqMoment(objDate).format('YYYY-MM-DD HH:mm:ss.SSSS');
        }
    } else {
        if (appDbType != null && appDbType != undefined && appDbType.toLowerCase() == 'oracle') {
            if (formatString) {
                return reqMoment(objDate).format(formatString);
            } else {
                return reqMoment(objDate).format('DD-MMM-YYYY hh:mm:ss A');
            }
        } else {
            if (formatString) {
                return reqMoment(objDate).format(formatString);
            } else {
                return reqMoment(objDate).format('YYYY-MM-DD HH:mm:ss.SSSS');
            }
        }
    }
}

function getDbTypeFromHeaders(pHeaders) {
    if (pHeaders && pHeaders['routingkey']) {
        return (mDbTypeSessionValues[connStr + '~' + (pHeaders['routingkey']).toUpperCase()] ? mDbTypeSessionValues[connStr + '~' + (pHeaders['routingkey']).toUpperCase()] : null);
    } else {
        return null;
    }
}

// Get and assign the service model shared property
function AssignServiceModel() {
    var reqDBInstance = require('../../instance/DBInstance');
    if (reqDBInstance.DBInstanceSession.SERVICE_MODEL != undefined && reqDBInstance.DBInstanceSession.SERVICE_MODEL.TRANDB != undefined) {
        strDbType = reqDBInstance.DBInstanceSession.SERVICE_MODEL.TRANDB;
    }
}
function loadAppDbType(pRedisKey, pVal, callback) {
    try {
        var result = {
            status: 'SUCCESS'
        };
        pRedisKey = pRedisKey.replace('TRANDB', 'DB_TYPE');
        if (pVal.DB_TYPE) {
            mDbTypeSessionValues[pRedisKey] = pVal.DB_TYPE;
        } else {
            result.status = 'FAILURE';
        }
        return callback(result);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230063', 'Error in loadAppDbType function', error);
        return callback(error);
    }
}





function GetUTCCurrentDate(objLogInfo) {
    try {
        var pDateValue = reqMoment().toISOString();
        // var pDateValue = reqMoment().toISOString();
        return pDateValue;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230066', 'Error in getUTCDate function', error);
        return callback(error);
    }
}


function GetUTCStartDate(value, objLogInfo) {
    try {
        var UTCStartDate = value.START_DATE;
        var ChangeTimeZone = objLogInfo.TIMEZONE_INFO.timezone_name;
        console.log(ChangeTimeZone);
        var newDate = new Date();
        var hours = newDate.getHours();
        var mins = newDate.getMinutes();
        var secs = newDate.getSeconds();
        UTCStartDate = new Date(UTCStartDate).setHours(hours, mins, secs);          // moment(currentvalue, 'DD/MM/YYYY hh:mm:ss').format()
        UTCStartDate = reqMoment(UTCStartDate).tz(ChangeTimeZone).startOf("day").utc().format();   // currentvalue.toLocaleString('en-US', { timeZone: ChangeTimeZone });
        console.log('UTCStartDate ' + UTCStartDate);
        return UTCStartDate;
    } catch (error) {
        console.log(error);
    }
}

// TO Get UTC END Date
function GetUTCEndDate(value, objLogInfo) {
    try {
        var UTCEndDate = value.END_DATE;
        var ChangeTimeZone = objLogInfo.TIMEZONE_INFO.timezone_name;
        var newDate = new Date();
        var hours = newDate.getHours();
        var mins = newDate.getMinutes();
        var secs = newDate.getSeconds();
        UTCEndDate = new Date(UTCEndDate).setHours(hours, mins, secs);
        UTCEndDate = reqMoment(UTCEndDate).tz(ChangeTimeZone).endOf("day").utc().format();   // currentvalue.toLocaleString('en-US', { timeZone: ChangeTimeZone });
        return UTCEndDate;
    } catch (error) {
        console.log(error);
    }
}

function FXUTCAuditColumn() {
    var utcColumn = [
        'CREATED_DATE_UTC',
        'MODIFIED_DATE_UTC',
    ];
    return utcColumn;
}



module.exports = {
    GetCurrentDate: GetCurrentDate,
    ConvertDate: ConvertDate,
    AssignServiceModel: AssignServiceModel,
    LoadAppDbType: loadAppDbType,
    GetCurrentDateInUTC: GetCurrentDateInUTC,
    GetTenantCurrentDate: GetTenantCurrentDate,
    GetDateAt12AM: GetDateAt12AM,
    GetDateAt12AMWithTenantTZ: GetDateAt12AMWithTenantTZ,
    GetDateTimeWithTenantTZ: GetDateTimeWithTenantTZ,
    GetSearchCriteriaForUTC: GetSearchCriteriaForUTC,
    GetSearchCriteriaForBusinessColumn: GetSearchCriteriaForBusinessColumn,
    GetUTCStartDate: GetUTCStartDate,
    GetUTCEndDate: GetUTCEndDate,
    GetDateAt12AM: GetDateAt12AM,
    FormatDateWithDBType: formatDateWithDBType,
    GetTenantCurrentDateTime: GetTenantCurrentDateTime,
    FXUTCAuditColumn: FXUTCAuditColumn,
    GetTenantCurrentDateTimeWithoutformat: GetTenantCurrentDateTimeWithoutformat
};
/************** End of File ************/