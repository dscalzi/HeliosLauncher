import { Agent } from "./Agent";

export interface AuthPayload {

    agent: Agent
    username: string
    password: string
    clientToken?: string
    requestUser?: boolean

}
