export function getRules(fd) {
  const entries = [
    ['Value', fd?.['Value Expression']],
    ['Hidden', fd?.['Hidden Expression']],
    ['Label', fd?.['Label Expression']],
  ];
  return entries.filter((e) => e[1]).map(([prop, expression]) => ({
    prop,
    expression,
  }));
}

function extractRules(data) {
  return data
    .reduce(({ fieldIdMap, rules, fieldIds }, fd, index) => {
      const currentRules = getRules(fd);
      return {
        fieldIdMap: {
          ...fieldIdMap,
          [index + 2]: { name: fd.Name, id: fd.Id },
        },
        rules: currentRules.length ? rules.concat([[fd.Id, currentRules]]) : rules,
        fieldIds: currentRules.length ? [...fieldIds, fd.Id] : fieldIds,
      };
    }, { fieldIdMap: {}, rules: [], fieldIds: [] });
}

export async function applyRuleEngine(form, formTag) {
  try {
    const RuleEngine = (await import('./RuleEngine.js')).default;

    const formData = extractRules(form);
    const { fieldIdMap, rules, fieldIds } = formData;

    const ruleEngine = new RuleEngine(rules, fieldIdMap, formTag);
    ruleEngine.enable();
    ruleEngine.applyRules(fieldIds);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('unable to apply rules ', e);
  }
}
