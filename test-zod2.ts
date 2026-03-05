import { subMissionsInsertSchema } from './shared/schema';

const payload = {
    title: '테스트',
    description: '',
    submissionTypes: ['link'],
    submissionLabels: { '0': '영수증리뷰 링크' },
    requireReview: true,
    studioFileFormat: 'pdf',
    studioDpi: 300,
    partyTemplateProjectId: null,
    partyMaxPages: null,
    actionTypeId: null,
    sequentialLevel: 0,
    attendanceType: null,
    attendancePassword: '',
    startDate: '',
    endDate: '',
    externalProductCode: '',
    externalProductName: '',
};

const result = subMissionsInsertSchema.partial().safeParse(payload);
if (!result.success) {
    console.log('Errors:', JSON.stringify(result.error.errors, null, 2));
} else {
    console.log('Success!', result.data);
}
