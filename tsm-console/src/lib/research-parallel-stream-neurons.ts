/**
 * Research-only, in-memory two-head logistic neural predictor for stream QoE.
 * It does NOT run automatically, persist telemetry, train on user data, or
 * override provenance, hydraulic evidence, or WebRTC congestion control.
 *
 * Head 1: estimated next-frame visibility need.
 * Head 2: estimated network congestion pressure.
 *
 * Inputs are explicit normalized, non-identifying features:
 * [cameraMotion, screenSpaceError, queuePressure, bandwidthUtilization].
 * Outputs remain research-only, even when holdout loss beats a mean baseline.
 */
export type StreamFeatures = readonly [number,number,number,number];
export interface StreamTrainingExample {
  readonly features: StreamFeatures;
  readonly visibilityTarget: number;
  readonly congestionTarget: number;
}
export interface StreamNeuralHead {
  readonly weights: StreamFeatures;
  readonly bias: number;
}
export interface ParallelStreamResearchModel {
  readonly schema: 'tsm.parallel-stream-neurons.research.v1';
  readonly classification: 'RESEARCH_ONLY';
  readonly authoritativeMutation: false;
  readonly trainingExamplesRetained: false;
  readonly visibility: StreamNeuralHead;
  readonly congestion: StreamNeuralHead;
  readonly acceptedForResearchInference: boolean;
  readonly validation: {
    readonly visibilityMse: number;
    readonly congestionMse: number;
    readonly visibilityBaselineMse: number;
    readonly congestionBaselineMse: number;
    readonly holdoutCount: number;
  };
}
const unit = (x: number): boolean => typeof x==='number' && Number.isFinite(x) && x>=0 && x<=1;
function checkFeatures(features: StreamFeatures): void {
  if (!Array.isArray(features) || features.length!==4 || !features.every(unit)) {
    throw new RangeError('Neural features must be four normalized non-identifying metrics');
  }
}
function sigmoid(x: number): number {
  if (x>=0) {const z=Math.exp(-x);return 1/(1+z);}
  const z=Math.exp(x);return z/(1+z);
}
function infer(head: StreamNeuralHead, features: StreamFeatures): number {
  let sum=head.bias;
  for(let i=0;i<4;i++)sum+=head.weights[i]!*features[i]!;
  return sigmoid(sum);
}
function mean(values: readonly number[]): number {
  return values.reduce((a,b)=>a+b,0)/values.length;
}
function mse(values: readonly number[],labels: readonly number[]): number {
  return values.reduce((sum,v,i)=>sum+(v-labels[i]!)**2,0)/values.length;
}
function fit(samples: readonly StreamTrainingExample[], target: 'visibilityTarget'|'congestionTarget',
  epochs: number, learningRate: number): StreamNeuralHead {
  const w=[0,0,0,0];let bias=0;
  for(let epoch=0;epoch<epochs;epoch++)for(const sample of samples) {
    const head={weights:w as unknown as StreamFeatures,bias};
    const y=infer(head,sample.features);
    const gradient=2*(y-sample[target])*y*(1-y);
    for(let i=0;i<4;i++)w[i]=Math.max(-12,Math.min(12,w[i]!-learningRate*(gradient*sample.features[i]!+0.0001*w[i]!)));
    bias=Math.max(-12,Math.min(12,bias-learningRate*gradient));
  }
  return {weights:[w[0]!,w[1]!,w[2]!,w[3]!],bias};
}
/** Explicit research call; the returned model contains weights and metrics, no training rows. */
export function trainParallelStreamNeurons(
  samples: readonly StreamTrainingExample[],
  options: {readonly epochs?:number;readonly learningRate?:number}={},
): ParallelStreamResearchModel {
  const epochs=options.epochs??120;
  const learningRate=options.learningRate??0.2;
  if(!Array.isArray(samples)||samples.length<10||samples.length>2048||
     !Number.isInteger(epochs)||epochs<1||epochs>300||
     !Number.isFinite(learningRate)||learningRate<=0||learningRate>0.5) {
    throw new RangeError('Invalid bounded neural research training request');
  }
  for(const sample of samples) {
    if(!sample)throw new RangeError('Training example missing');
    checkFeatures(sample.features);
    if(!unit(sample.visibilityTarget)||!unit(sample.congestionTarget))throw new RangeError('Invalid normalized research labels');
  }
  const train=samples.filter((_,i)=>i%5!==0);
  const holdout=samples.filter((_,i)=>i%5===0);
  const visibility=fit(train,'visibilityTarget',epochs,learningRate);
  const congestion=fit(train,'congestionTarget',epochs,learningRate);
  const visLabels=holdout.map(s=>s.visibilityTarget),conLabels=holdout.map(s=>s.congestionTarget);
  const visBase=mean(train.map(s=>s.visibilityTarget)),conBase=mean(train.map(s=>s.congestionTarget));
  const validation={
    visibilityMse:mse(holdout.map(s=>infer(visibility,s.features)),visLabels),
    congestionMse:mse(holdout.map(s=>infer(congestion,s.features)),conLabels),
    visibilityBaselineMse:mse(holdout.map(()=>visBase),visLabels),
    congestionBaselineMse:mse(holdout.map(()=>conBase),conLabels),
    holdoutCount:holdout.length,
  };
  const acceptedForResearchInference=validation.visibilityMse+0.001<validation.visibilityBaselineMse &&
    validation.congestionMse+0.001<validation.congestionBaselineMse;
  return {schema:'tsm.parallel-stream-neurons.research.v1',
    classification:'RESEARCH_ONLY',authoritativeMutation:false,trainingExamplesRetained:false,
    visibility,congestion,acceptedForResearchInference,validation};
}
export function predictParallelStreamNeurons(
  model: ParallelStreamResearchModel,features: StreamFeatures,
): {visibility:number;congestion:number;mode:'research-inference'|'deterministic-fallback';classification:'RESEARCH_ONLY'} {
  checkFeatures(features);
  if(!model||model.schema!=='tsm.parallel-stream-neurons.research.v1'||
    model.classification!=='RESEARCH_ONLY'||model.authoritativeMutation!==false||
    model.trainingExamplesRetained!==false)throw new Error('Neural research boundary violated');
  if(!model.acceptedForResearchInference) {
    return {visibility:features[1],congestion:features[3],mode:'deterministic-fallback',classification:'RESEARCH_ONLY'};
  }
  if(!model.visibility||!model.congestion||
     ![...model.visibility.weights,...model.congestion.weights,model.visibility.bias,model.congestion.bias].every(Number.isFinite)) {
    throw new Error('Non-finite neural research weights');
  }
  return {visibility:infer(model.visibility,features),congestion:infer(model.congestion,features),
    mode:'research-inference',classification:'RESEARCH_ONLY'};
}
