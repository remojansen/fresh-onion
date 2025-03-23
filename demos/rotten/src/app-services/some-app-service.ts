import { SomeRepositoryImplementation } from "../infrastructure/storage/some-repository-imp";

export class SomeAppService {
  constructor(private readonly someRepository: SomeRepositoryImplementation) {}

  async getSomeData() {
    return this.someRepository.getSomeData();
  }
}
