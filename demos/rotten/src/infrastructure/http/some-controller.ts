import { SomeAppService } from "../../app-services/some-app-service";

export class SomeController {
  constructor(private readonly someService: SomeAppService) {}

  async getSomeData() {
    return this.someService.getSomeData();
  }
}
