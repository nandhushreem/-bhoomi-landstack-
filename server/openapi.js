const json={description:'JSON response',content:{'application/json':{schema:{type:'object'}}}};
const error={description:'Request rejected',content:{'application/json':{schema:{type:'object',properties:{error:{type:'string'}}}}}};
const response=(summary,secured=false)=>({summary,...(secured?{security:[{session:[]}]}:{}),responses:{200:json,400:error,401:error,403:error,409:error,429:error}});
const body=(properties,required=[])=>({required:true,content:{'application/json':{schema:{type:'object',properties,required}}}});
const str={type:'string'};
export const specification={
 openapi:'3.1.0',info:{title:'Bhoomi Land Stack API',version:'1.0.0',description:'SIH26014 synthetic demonstration. Cookie authentication. GeoJSON coordinates use WGS84 longitude, latitude. Demo officers intentionally have access to synthetic records.'},
 components:{securitySchemes:{session:{type:'apiKey',in:'cookie',name:'bhoomi_session'}}},
 paths:{
  '/api/health':{get:response('Database readiness')},
  '/api/auth/me':{get:response('Current session identity')},
  '/api/auth/demo':{post:{...response('Create an explicit synthetic-data demo session'),requestBody:body({role:{type:'string',enum:['citizen','officer']}},['role'])}},
  '/api/auth/register':{post:{...response('Create citizen account'),requestBody:body({name:str,email:{type:'string',format:'email'},password:{type:'string',minLength:10,maxLength:128}},['name','email','password']),responses:{201:json,400:error,409:error,429:error}}},
  '/api/auth/login':{post:{...response('Sign in'),requestBody:body({email:str,password:str},['email','password'])}},
  '/api/auth/logout':{post:response('End current session',true)},
  '/api/parcels':{get:response('Read synthetic parcel records, geometry and indicators')},
  '/api/parcels/{id}/history':{get:{...response('Read synthetic parcel audit history'),parameters:[{name:'id',in:'path',required:true,schema:str}]}},
  '/api/applications':{
   get:response('Citizen own requests or officer queue',true),
   post:{...response('Submit citizen request',true),requestBody:body({parcel_id:str,service:{type:'string',enum:['Area correction','Ownership record enquiry','Building permission enquiry']},details:{type:'string',minLength:10,maxLength:2000},requested_area:{type:'number',exclusiveMinimum:0,maximum:10000000}},['parcel_id','service','details']),responses:{201:json,400:error,401:error,403:error,404:error,429:error}}
  },
  '/api/applications/{id}/decision':{post:{...response('Officer decision with atomic record update and version check',true),parameters:[{name:'id',in:'path',required:true,schema:str}],requestBody:body({decision:{type:'string',enum:['Approved','Rejected']},reason:{type:'string',minLength:10,maxLength:1000},dispute_reviewed:{type:'boolean'}},['decision','reason'])}},
  '/api/analytics':{get:response('Aggregate synthetic governance statistics')}
 }
};
