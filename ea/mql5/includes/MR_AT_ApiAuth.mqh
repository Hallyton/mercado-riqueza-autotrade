//+------------------------------------------------------------------+
//| MR_AT_ApiAuth.mqh — chamadas autenticadas com recuperação de token |
//+------------------------------------------------------------------+
#property strict

bool MR_AT_ApiGetAuth(const string path, string &body, int &status);
bool MR_AT_ApiPostAuth(const string path, const string json_body, string &body, int &status);
