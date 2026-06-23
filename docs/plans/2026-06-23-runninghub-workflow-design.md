# SeeThrough RunningHub Workflow Design

**Goal:** Add a fixed RunningHub workflow app named `SeeThrough分层`.

**Confirmed Scope**
- Add `Workflow` as a third provider type.
- Add one built-in workflow app under it: `seethrough`, displayed as `SeeThrough分层`.
- The RunningHub App ID is hard-coded as `2040054307541749762`.
- Hide RunningHub base URL and App ID from the user.
- User only provides a RunningHub API Key and one uploaded/reference image.
- Request body is fixed:

```json
{
  "nodeInfoList": [
    {
      "nodeId": "1",
      "fieldName": "image",
      "fieldValue": "uploaded fileName",
      "description": "上传图片image"
    }
  ],
  "instanceType": "default",
  "usePersonalQueue": "false"
}
```

**Runtime Flow**
- User selects provider type `Workflow`.
- User selects workflow app `SeeThrough分层`.
- User enters RunningHub API Key.
- User drags or selects one image.
- The task uses the existing queue and SQLite tables.
- Worker uploads the local image to `https://www.runninghub.cn/openapi/v2/media/upload/binary`.
- Worker submits `https://www.runninghub.cn/openapi/v2/run/ai-app/2040054307541749762`.
- Worker polls `https://www.runninghub.cn/openapi/v2/query`.
- Successful URL results are downloaded to the selected output directory and shown in the existing task detail view.

**Data Model**
- No generic node editor and no workflow JSON column.
- Store workflow tasks as provider format `workflow`.
- Store the selected built-in workflow app as `model = "seethrough"`.
- Keep `baseUrl` internally set to the fixed RunningHub base URL.
- Keep the fixed RunningHub App ID internal to the adapter, not in persisted task settings.

**Error Handling**
- Missing API Key fails validation.
- Missing reference image fails validation.
- Upload, submit, query, failed workflow status, and timeout mark the task failed with a clear message.

**Testing**
- Unit-test provider routing and RunningHub request body.
- Unit-test missing image validation.
- Unit-test upload value binding to node `1.image`.
- Run full tests, typecheck/build, and package.
