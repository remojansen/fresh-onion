import { SomeRepository } from "../../domain-services/some-repository";

export class SomeRepositoryImplementation implements SomeRepository {
    async getSomeData() {
        return { someProperty: 'some value' };
    }
}
