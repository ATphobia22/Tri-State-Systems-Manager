import type {AuthorizationDecision,CapabilityContext,CapabilityDefinition,CapabilityRequest,PolicyEngine} from '../../contracts/src/index.ts';

export interface PolicyRule{readonly capability:string;readonly allow?:boolean;readonly requireApproval?:boolean;readonly permissions?:readonly string[]}

function specificity(rule: PolicyRule, capability: string): number {
  if (rule.capability === capability) return 3;
  if (rule.capability.endsWith('.*') && capability.startsWith(rule.capability.slice(0, -1))) return 2;
  if (rule.capability === '*') return 1;
  return 0;
}

export class StaticPolicyEngine implements PolicyEngine{
  constructor(private readonly rules:readonly PolicyRule[]=[]) {}

  async authorize(request:CapabilityRequest):Promise<AuthorizationDecision>{
    const matching=this.rules
      .map((rule,index)=>({rule,index,score:specificity(rule,request.capability)}))
      .filter((entry)=>entry.score>0)
      .sort((a,b)=>b.score-a.score||b.index-a.index);
    const selected=matching[0]?.rule;
    if(!selected) return {allowed:false,reason:`No policy rule for ${request.capability}`};
    if(selected.allow===false) return {allowed:false,reason:`Denied by policy rule for ${request.capability}`};
    if(selected.permissions?.some((permission)=>!request.context.permissions.allow.includes(permission))){
      return {allowed:false,reason:'Required permission missing'};
    }
    return {allowed:true,requireApproval:selected.requireApproval??false};
  }

  async canUse(capability:CapabilityDefinition,context:CapabilityContext):Promise<boolean>{
    const decision=await this.authorize({capability:capability.id,input:undefined,context});
    return decision.allowed&&capability.permissions.every((permission)=>context.permissions.allow.includes(permission));
  }
}
