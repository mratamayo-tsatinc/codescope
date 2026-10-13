// Stable profile-authoring vocabulary shared by the runtime and Profile Designer.
// Teacher-managed profile/category definitions live in profiles.js.
const OPS = {
  ADD_SUB:     ['+','-'],
  ARITH_BASIC: ['+','-','*','/'],
  ARITH_ALL:   ['+','-','*','/','%'],
  COMPARISON:  ['<','>','<=','>=','==','!='],
  LOGICAL:     ['&&','||'],
  // NOTE: deliberately no '!' here or anywhere in OPS. '!' is never a binary
  // operator in this engine — prec()/evalOp() (engine.js) have no case for
  // it, only makeUnary() does. It only ever appears via a profile's
  // extras.unaryWrap.operators, never in an `allowed` list.
};
