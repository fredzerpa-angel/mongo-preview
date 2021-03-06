const axios = require('axios');
const { DateTime } = require('luxon');
const xlsx = require('node-xlsx').default;
const { convertObjectStringToSchema } = require('../../utils/functions.utils');

const ArcadatClient = axios.create({
  baseURL: 'https://www.arcadat.com/apps/',
});

async function getStudents() {
  // Fetch un archivo Excel - Ya que no existe un JSON Endpoint para la obtencion de estudiantes
  const options = {
    url: 'rptxls/eGxzZGdzYQ/?p=NjcyNw',
    responseType: 'arraybuffer',
    transformResponse: [
      data => {
        // Transforma la data para poder leer caracteres especiales en el lexico español
        const dataWithAccents = data.toString('latin1');
        // Tranforma la data a buffer array otra vez
        const arrayBuffer = new TextEncoder().encode(dataWithAccents).buffer;
        return arrayBuffer;
      },
    ],
  };

  const { data } = await ArcadatClient(options);

  // Convierte la data del archivo Excel a una estructura JSON
  const parsedExcelData = xlsx.parse(data);

  // Creamos un diccionario con las propiedades del Fetch y de Student Schema
  const SCHEMA_MAP = {
    'Nivel inscrito': 'gradeLevelAttended',
    'Plan de pago': 'paymentPlan',
    'Plan de descuento': 'discountPlan',
    'N° de identificación': 'documentId.number',
    Apellidos: 'lastnames',
    Nombres: 'names',
    'Apellidos y Nombres': 'fullname',
    Sexo: 'gender',
    'Fecha de nacimiento': 'birthdate',
    Edad: 'age',
    'Lugar de nacimiento': 'addressOfBirth.full',
    Dirección: 'addresses.full',
    Teléfonos: 'phones.secondary',
    'Teléfono celular': 'phones.main',
    'Correo electrónico': 'email',
    'Identificador padre': 'parents.father.documentId.number',
    'Apellidos y nombres del padre': 'parents.father.fullname',
    'Teléfonos padre': 'parents.father.phones.secondary',
    'Teléfono celular padre': 'parents.father.phones.main',
    'Correo electrónico padre': 'parents.father.email',
    'Identificador madre': 'parents.mother.documentId.number',
    'Apellidos y nombres de la madre': 'parents.mother.fullname',
    'Teléfonos madre': 'parents.mother.phones.secondary',
    'Teléfono celular madre': 'parents.mother.phones.main',
    'Correo electrónico madre': 'parents.mother.email',
    'Identificador representante': 'parents.admin.documentId.number',
    'Apellidos y nombres Representante': 'parents.admin.fullname',
    'Teléfonos representante': 'parents.admin.phones.secondary',
    'Teléfono celular representante': 'parents.admin.phones.main',
    'Correo electrónico representante': 'parents.admin.email',
    'Codigo de afiliado domiciliacion': 'directDebit.affiliatedCode',
    'Id afiliado domiciliacion': 'directDebit.id',
    'Nombre afiliado domiciliacion': 'directDebit.name',
    'Cuenta domiciliacion': 'directDebit.account',
  };

  // Refactorizamos la respuesta de Axios y XLSX a que solo retorne la data de los estudiantes, y estos ya ligados a sus respectivos Headers
  const result = parsedExcelData.reduce((result, data, i, arr) => {
    // Evitamos los headers, ya que solo nos interesa la data de los estudiantes
    const headersIndex = 1;
    const headers = arr[headersIndex].data[0];
    if (i <= headersIndex) return result;

    const studentData = data.data[0];
    // Unimos la data de los estudiantes con sus respectivos Headers
    const studentWithHeaders = studentData.reduce((student, data, idx) => {
      // Eliminamos caracteres especiales innecesarios en nuestra data
      const specialCharacters = "'-";
      const findSpecialCharacters = new RegExp(`[${specialCharacters}]`, 'gi');
      // En este caso solo eliminamos estos characteres si la data esta sucia
      data = data.length > 1 ? data : data.replace(findSpecialCharacters, '');
      data = data.replace(/no posee/gi, '');

      const header = SCHEMA_MAP[headers[idx]];

      // Eliminamos cualquier character que no sea numero
      if (header.includes('documentId.number')) data = data.replace(/\D/gi, '');

      // Transformamos la fecha a una reconocida por el constructor Date de JS
      if (header === 'birthdate')
        data = DateTime.fromFormat(data, 'dd/MM/yyyy').toJSDate();
      return data
        ? {
          ...student,
          [header]: data,
        }
        : student;
    }, {});

    // Refactorizamos la data conviertiendo los Headers a una estructura Esquematica
    result.push(convertObjectStringToSchema(studentWithHeaders));

    return result;
  }, []);

  // Retornamos la data de los estudiantes ya refactorizada
  return result;
}

async function getPayments() {
  // Creamos la data de un Formulario para hacer un Fetch Post
  var form = new URLSearchParams();
  form.append('o', '1');
  form.append('year_init', '2021');
  form.append('year_end', '2022');

  // Usamos el Endpoint de Alberto para obtener los pagos registrados en Arcadat
  const config = {
    method: 'post',
    url: 'json/web_service/alberto/pagos/',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: form,
  };

  // Obtenemos los pagos registrados en Arcadat
  const {
    data: { data: payments },
  } = await ArcadatClient(config);

  // Creamos un diccionario con las propiedades del Fetch y de Payments Schema
  const SCHEMA_MAP = {
    period: 'schoolTerm',
    concept: 'concept',
    bill: 'billId',
    payment_date: 'time.date',
    payment_hour: 'time.hour',
    name_user: 'cashier.fullname',
    id_payment_holder: 'paymentHolder.refId',
    payment_holder: 'paymentHolder.fullname',
    'amount bs': 'amount.bs',
    'amount USD': 'amount.usd',
    rate: 'amount.convertionRate.rate',
    discount: 'discount.bs',
    credit: 'isCredit',
    id_student: 'student.documentId.number',
    name_student: 'student.fullname',
    canceled: 'canceled',
  };

  // Refactorizamos el Schema de los pagos registrados en Arcadat
  // A nuestro Schema de pagos
  const refactoredPaymentsSchema = payments.map(payment => {
    // Transforma las Keys de los Objects a seguir el SCHEMA_MAP
    const paymentWithSchema = Object.fromEntries(
      Object.entries(payment).map(([key, value]) => { 
        const header = SCHEMA_MAP[key];
        // Reemplazamos cualquier character que nosea numero del documentId 
        if (header.includes('documentId.number')) value = value.replace(/\D/gi, '');
        
        return [header, value];
      })
    );

    //  Añadimos propiedades faltantes a nuestro pago
    paymentWithSchema['time.datetime'] =
      paymentWithSchema['time.date'] + ' ' + paymentWithSchema['time.hour'];
    paymentWithSchema['discount.convertionRate.rate'] =
      paymentWithSchema['amount.convertionRate.rate'];
    paymentWithSchema['discount.usd'] = Number(
      (
        paymentWithSchema['discount.bs'] /
        paymentWithSchema['amount.convertionRate.rate']
      ).toFixed(2)
    );

    // Refactorizamos el Object para que asimile al Payments Schema
    return convertObjectStringToSchema(paymentWithSchema);
  });

  return refactoredPaymentsSchema;
}

async function getPendingDebts() {
  // Creamos la data de un Formulario para hacer un Fetch Post
  var form = new URLSearchParams();
  form.append('o', '2');
  form.append('year_init', '2021');
  form.append('year_end', '2022');

  // Usamos el Endpoint de Alberto para obtener las deudas pendientes registrados en Arcadat
  const config = {
    method: 'post',
    url: 'json/web_service/alberto/pagos/',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: form,
  };

  // Obtenemos las deudas registrados en Arcadat
  const {
    data: { data: debts },
  } = await ArcadatClient(config);

  // Creamos un diccionario con las propiedades del Fetch y de Debts Schema
  const SCHEMA_MAP = {
    period: 'schoolTerm',
    id_student: 'student.documentId.number',
    name_student: 'student.fullname',
    concept: 'concept',
    amount: 'amount.usd',
    expiration_date: 'status.issuedDate',
  };

  // Refactorizamos el Schema de las deudas registrados en Arcadat
  // A nuestro Schema de deudas
  const refactoredDebtsSchema = debts.map(debt => {
    // Transformamos las Objects Keys a las usadas en SCHEMA_MAP
    const debtWithSchema = Object.fromEntries(
      Object.entries(debt).map(([key, value]) => {
        if (key !== 'expiration_date') return [SCHEMA_MAP[key], value];

        // Get only the date from expiration_date
        return [SCHEMA_MAP[key], value.date];
      })
    );

    // Refactorizamos el Object para que asimile al Debts Schema
    return convertObjectStringToSchema(debtWithSchema);
  });

  return refactoredDebtsSchema;
}

async function getAcademicParents() {
  // Fetch un archivo Excel - Ya que no existe un JSON Endpoint para la obtencion de padres academicos
  const options = {
    url: 'rptxls/eGxzZGdw/?p=NjcyNw',
    responseType: 'arraybuffer',
    transformResponse: [
      data => {
        // Convert data to be able to read accents and special characters from spanish lexic
        const dataWithAccents = data.toString('latin1');
        // Return it as a buffer, because XLSX package use buffers
        const arrayBuffer = new TextEncoder().encode(dataWithAccents).buffer;
        return arrayBuffer;
      },
    ],
  };

  const { data } = await ArcadatClient(options);

  // Convierte la data del archivo Excel a una estructura JSON
  const parsedExcelData = xlsx.parse(data);

  // Creamos un diccionario con las propiedades del Fetch y de Parents Schema
  const SCHEMA_MAP = {
    Tipo: 'type',
    Identificador: 'documentId.number',
    'Apellidos y Nombres': 'fullname',
    'Teléfonos/Nivel que cursa': 'phones',
    'Correo electrónico': 'email',
  };

  // Refactorizamos la respuesta de Axios y XLSX a que solo retorne la data de los padres, y estos ya ligados a sus respectivos Headers
  const parentsAndChildrenWithSchema = parsedExcelData.reduce(
    (result, data, i, arr) => {
      // Evitamos los headers, ya que solo nos interesa la data de los padres
      const headersIndex = 1;
      const headers = arr[headersIndex].data[0];
      if (i <= headersIndex) return result;

      const parentData = data.data[0];
      // Unimos la data de los padres con sus respectivos Headers
      const dataWithSchema = parentData.reduce((parent, data, idx, arr) => {
        // Eliminamos data innecesaria
        data = data.replace(/TELÉFONOS: /gi, '');
        data = data.replace(/no posee/gi, '');

        const header = SCHEMA_MAP[headers[idx]];

        if (header.includes('documentId.number')) data = data.replace(/\D/gi, '');

        if (header === 'phones') {
          // Limpiamos y separamos los telefonos
          data = data
            .split('.')
            .map(num => num.trim())
            .filter(num => num);

          return data.length > 1
            ? {
              ...parent,
              // Telefono celular
              'phones.main': data[1],
              // Telefono fijo
              'phones.secondary': data[0],
            }
            : {
              ...parent,
              // Telefono celular
              'phones.main': data[0],
            };
        }

        return data
          ? {
            ...parent,
            [header]: data,
          }
          : parent;
      }, {});

      // Refactorizamos la data conviertiendo los Headers a una estructura Esquematica
      result.push(convertObjectStringToSchema(dataWithSchema));

      return result;
    },
    []
  );

  const parentsWithSchema = parentsAndChildrenWithSchema.reduce(
    (parentsCollection, data, idx, arr) => {
      const isParent = !data.type.toLowerCase().includes('hijo');
      delete data.type;
      if (isParent) {
        // Agregamos al padre
        parentsCollection.push({ ...data, children: [] });
      } else {
        delete data.phones;
        // Agregamos el hijo/a al ultimo padre agregado
        parentsCollection.at(-1).children.push(data);
      }

      return parentsCollection;
    },
    []
  );

  // Retornamos la data de los estudiantes ya refactorizada
  return parentsWithSchema;
}

module.exports = {
  getStudents,
  getPayments,
  getPendingDebts,
  getAcademicParents,
};
