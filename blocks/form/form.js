import { sampleRUM } from '../../scripts/lib-franklin.js';
import decorateFieldset from './fieldset.js';

function generateUnique() {
  return new Date().valueOf() + Math.random();
}

function constructPayload(form) {
  const payload = { __id__: generateUnique() };
  [...form.elements].forEach((fe) => {
    if (fe.name) {
      if (fe.type === 'radio') {
        if (fe.checked) payload[fe.name] = fe.value;
      } else if (fe.type === 'checkbox') {
        if (fe.checked) payload[fe.name] = payload[fe.name] ? `${payload[fe.name]},${fe.value}` : fe.value;
      } else if (fe.type !== 'file') {
        payload[fe.name] = fe.value;
      }
    }
  });
  return { payload };
}

async function submissionFailure(error, form) {
  alert(error); // TODO define error mechansim
  form.setAttribute('data-submitting', 'false');
  form.querySelector('button[type="submit"]').disabled = false;
}

async function prepareRequest(form) {
  const { payload } = constructPayload(form);
  const headers = {
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({ data: payload });
  const url = form.dataset.action;
  return { headers, body, url };
}

async function submitForm(form) {
  try {
    const { headers, body, url } = await prepareRequest(form);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    if (response.ok) {
      sampleRUM('form:submit');
      window.location.href = form.dataset?.redirect || 'thankyou';
    } else {
      const error = await response.text();
      throw new Error(error);
    }
  } catch (error) {
    submissionFailure(error, form);
  }
}

async function handleSubmit(form) {
  if (form.getAttribute('data-submitting') !== 'true') {
    form.setAttribute('data-submitting', 'true');
    await submitForm(form);
  }
}

function setPlaceholder(element, fd) {
  if (fd.Placeholder) {
    element.setAttribute('placeholder', fd.Placeholder);
  }
}

const constraintsDef = Object.entries({
  'email|text': [['Max', 'maxlength'], ['Min', 'minlength']],
  'number|range|date': ['Max', 'Min', 'Step'],
  file: ['Accept', 'Multiple'],
  fieldset: ['Max', 'Min'],
}).flatMap(([types, constraintDef]) => types.split('|')
  .map((type) => [type, constraintDef.map((cd) => (Array.isArray(cd) ? cd : [cd, cd]))]));

const constraintsObject = Object.fromEntries(constraintsDef);

function setConstraints(element, fd) {
  const constraints = constraintsObject[fd.Type];
  if (constraints) {
    constraints
      .filter(([nm]) => fd[nm])
      .forEach(([nm, htmlNm]) => {
        element.setAttribute(htmlNm, fd[nm]);
      });
  }
}

function createLabel(fd, tagName = 'label') {
  const label = document.createElement(tagName);
  label.setAttribute('for', fd.Id);
  label.className = 'field-label';
  label.textContent = fd.Label || '';
  if (fd.Type !== 'radio') {
    label.setAttribute('itemprop', 'Label');
    label.setAttribute('itemtype', 'text');
  }
  if (fd.Tooltip) {
    label.title = fd.Tooltip;
  }
  return label;
}

function createHelpText(fd) {
  const div = document.createElement('div');
  div.className = 'field-description';
  div.setAttribute('aria-live', 'polite');
  div.setAttribute('itemtype', 'text');
  div.setAttribute('itemprop', 'Description');
  div.innerText = fd.Description;
  div.id = `${fd.Id}-description`;
  return div;
}

function createFieldWrapper(fd, tagName = 'div') {
  const fieldWrapper = document.createElement(tagName);
  if (fd.Type !== 'radio') {
    fieldWrapper.setAttribute('itemtype', 'component');
    fieldWrapper.setAttribute('itemid', generateItemId(fd.Id));
    fieldWrapper.setAttribute('itemscope', '');
    fieldWrapper.setAttribute('data-editor-itemlabel', fd.Label || fd.Name);
  }
  const nameStyle = fd.Name ? ` form-${fd.Name}` : '';
  const fieldId = `form-${fd.Type}-wrapper${nameStyle}`;
  fieldWrapper.className = fieldId;
  if (fd.Fieldset) {
    fieldWrapper.dataset.fieldset = fd.Fieldset;
  }
  if (fd.Mandatory.toLowerCase() === 'true') {
    fieldWrapper.dataset.required = '';
  }
  fieldWrapper.classList.add('field-wrapper');
  fieldWrapper.append(createLabel(fd));
  return fieldWrapper;
}

function createButton(fd) {
  const wrapper = createFieldWrapper(fd);
  const button = document.createElement('button');
  button.textContent = fd.Label;
  button.type = fd.Type;
  button.classList.add('button');
  button.dataset.redirect = fd.Extra || '';
  button.id = fd.Id;
  button.name = fd.Name;
  wrapper.replaceChildren(button);
  return wrapper;
}
function createSubmit(fd) {
  const wrapper = createButton(fd);
  return wrapper;
}

function createInput(fd) {
  const input = document.createElement('input');
  input.type = fd.Type;
  setPlaceholder(input, fd);
  setConstraints(input, fd);
  return input;
}

const withFieldWrapper = (element) => (fd) => {
  const wrapper = createFieldWrapper(fd);
  wrapper.append(element(fd));
  return wrapper;
};

const createTextArea = withFieldWrapper((fd) => {
  const input = document.createElement('textarea');
  setPlaceholder(input, fd);
  return input;
});

const createSelect = withFieldWrapper((fd) => {
  const select = document.createElement('select');
  if (fd.Placeholder) {
    const ph = document.createElement('option');
    ph.textContent = fd.Placeholder;
    ph.setAttribute('selected', '');
    ph.setAttribute('disabled', '');
    select.append(ph);
  }
  fd.Options.split(',').forEach((o) => {
    const option = document.createElement('option');
    option.textContent = o.trim();
    option.value = o.trim();
    select.append(option);
  });
  return select;
});

function createRadio(fd) {
  const wrapper = createFieldWrapper(fd);
  wrapper.insertAdjacentElement('afterbegin', createInput(fd));
  return wrapper;
}

const createOutput = withFieldWrapper((fd) => {
  const output = document.createElement('output');
  output.name = fd.Name;
  output.dataset.fieldset = fd.Fieldset ? fd.Fieldset : '';
  output.innerText = fd.Value;
  return output;
});

function createHidden(fd) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.id = fd.Id;
  input.name = fd.Name;
  input.value = fd.Value;
  return input;
}

function createLegend(fd) {
  return createLabel(fd, 'legend');
}

function createFieldSet(fd) {
  const wrapper = createFieldWrapper(fd, 'fieldset');
  wrapper.name = fd.Name;
  wrapper.setAttribute('itemtype', 'container');
  wrapper.replaceChildren(createLegend(fd));
  if (fd.Repeatable && fd.Repeatable.toLowerCase() === 'true') {
    setConstraints(wrapper, fd);
    wrapper.dataset.repeatable = 'true';
  }
  return wrapper;
}

function groupFieldsByFieldSet(form) {
  const fieldsets = form.querySelectorAll('fieldset');
  fieldsets?.forEach((fieldset) => {
    const fields = form.querySelectorAll(`[data-fieldset="${fieldset.name}"`);
    fields?.forEach((field) => {
      fieldset.append(field);
    });
  });
}

function createPlainText(fd) {
  const paragraph = document.createElement('p');
  const nameStyle = fd.Name ? `form-${fd.Name}` : '';
  paragraph.className = nameStyle;
  paragraph.dataset.fieldset = fd.Fieldset ? fd.Fieldset : '';
  paragraph.textContent = fd.Label;
  return paragraph;
}

const getId = (function getId() {
  const ids = {};
  return (name) => {
    ids[name] = ids[name] || 0;
    const idSuffix = ids[name] ? `-${ids[name]}` : '';
    ids[name] += 1;
    return `${name}${idSuffix}`;
  };
}());

const fieldRenderers = {
  radio: createRadio,
  checkbox: createRadio,
  textarea: createTextArea,
  select: createSelect,
  button: createButton,
  submit: createSubmit,
  output: createOutput,
  hidden: createHidden,
  fieldset: createFieldSet,
  plaintext: createPlainText,
};

function renderField(fd) {
  const renderer = fieldRenderers[fd.Type];
  let field;
  if (typeof renderer === 'function') {
    field = renderer(fd);
  } else {
    field = createFieldWrapper(fd);
    field.append(createInput(fd));
  }
  if (fd.Description) {
    field.append(createHelpText(fd));
  }
  return field;
}

function decorateFormFields(form) {
  decorateFieldset(form);
}

async function fetchData(url) {
  const resp = await fetch(url);
  const json = await resp.json();
  return json.data.map((fd) => ({
    ...fd,
    Id: fd.Id || getId(fd.Name),
    Value: fd.Value || '',
  }));
}

async function fetchForm(pathname) {
  // get the main form
  const jsonData = await fetchData(pathname);
  return jsonData;
}

async function createForm(formURL) {
  const { pathname } = new URL(formURL);
  window.formPath = pathname;
  const data = await fetchForm(pathname);
  const form = document.createElement('form');
  data.forEach((fd) => {
    const el = renderField(fd);
    const input = el.querySelector('input,textarea,select');
    if (fd.Mandatory && fd.Mandatory.toLowerCase() === 'true') {
      input.setAttribute('required', 'required');
    }
    if (input) {
      input.id = fd.Id;
      input.name = fd.Name;
      input.value = fd.Value;
      if (fd.Description) {
        input.setAttribute('aria-describedby', `${fd.Id}-description`);
      }
    }
    form.append(el);
  });
  groupFieldsByFieldSet(form);
  // eslint-disable-next-line prefer-destructuring
  form.dataset.action = pathname.split('.json')[0];
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    e.submitter.setAttribute('disabled', '');
    handleSubmit(form);
  });
  decorateFormFields(form);
  return form;
}

function generateItemId(id) {
  if (id) {
    return `urn:fnkconnection:${window.formPath}:default:Id:${id}`;
  } else {
    return `urn:fnkconnection:${window.formPath}:default`;
  }
}


export default async function decorate(block) {
  const formLink = block.querySelector('a[href$=".json"]');
  if (formLink) {
    const form = await createForm(formLink.href);
    form.setAttribute('itemid', generateItemId());
    form.setAttribute('itemtype', 'container');
    form.setAttribute('itemscope', '');
    form.setAttribute('data-editor-itemlabel', "Form Container");
    formLink.replaceWith(form);
  }
}
